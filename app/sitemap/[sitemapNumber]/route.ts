import { NextRequest, NextResponse } from 'next/server';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import {
    getSourceSitemapUrl,
    getUrlsToRemove,
    getUrlsToAdd,
    getDomainToReplace,
    getOriginDomain,
    getSitemapLimit
} from '../../sitemap.xml/config';

export async function GET(request: NextRequest, context: { params: { sitemapNumber: string } }) {
    try {
        const pageParam = (await context.params)?.sitemapNumber.replace('.xml', '');
        const pageNumber = parseInt(pageParam, 10);
        if (!Number.isFinite(pageNumber) || pageNumber < 1) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Fetch configuration
        const [sourceSitemapUrl, urlsToRemove, urlsToAdd, domainToReplace, originDomain, sitemapLimit] = await Promise.all([
            getSourceSitemapUrl(),
            getUrlsToRemove(),
            getUrlsToAdd(),
            getDomainToReplace(),
            getOriginDomain(),
            getSitemapLimit()
        ]);

        // Fetch the original sitemap
        const response = await fetch(sourceSitemapUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch sitemap from ${sourceSitemapUrl}: ${response.statusText}`);
        }
        const xmlText = await response.text();

        // Configure the XML parser
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            allowBooleanAttributes: true,
            parseAttributeValue: true,
            trimValues: true,
            isArray: (name, jpath) => jpath === 'urlset.url'
        });

        // Parse the XML
        let sitemapObject = parser.parse(xmlText);

        if (!(sitemapObject.urlset && sitemapObject.urlset.url)) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Keep any xmlns attributes from the original urlset to preserve namespaces
        const urlsetAttrs: Record<string, string> = Object.fromEntries(
            Object.entries(sitemapObject.urlset)
                .filter(([key]) => key.startsWith('@_'))
                .map(([key, value]) => [key, String(value)])
        );

        // Remove URLs if needed
        if (urlsToRemove.length > 0) {
            sitemapObject.urlset.url = sitemapObject.urlset.url.filter((entry: any) => {
                return entry.loc && !urlsToRemove.some(pattern => urlMatchesPattern(entry.loc, pattern));
            });
        }

        // Add new URLs if needed
        if (urlsToAdd.length > 0) {
            sitemapObject.urlset.url = [
                ...sitemapObject.urlset.url,
                ...urlsToAdd.map((url: string) => ({ loc: url }))
            ];
        }

        // Replace domain if needed
        if (domainToReplace && originDomain) {
            sitemapObject.urlset.url = sitemapObject.urlset.url.map((entry: any) => {
                if (entry.loc && typeof entry.loc === 'string' && entry.loc.startsWith(originDomain)) {
                    entry.loc = entry.loc.replace(originDomain, domainToReplace);
                }
                return entry;
            });
        }

        const urls: Array<{ loc: string }> = sitemapObject.urlset.url;
        const totalUrls = urls.length;

        // Compute slice for this page
        const startIndex = (pageNumber - 1) * sitemapLimit;
        if (startIndex >= totalUrls) {
            return new NextResponse('Not Found', { status: 404 });
        }
        const endIndex = Math.min(startIndex + sitemapLimit, totalUrls);
        const chunk = urls.slice(startIndex, endIndex);

        const builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            format: true,
            suppressEmptyNode: true,
        });

        // Build a fresh urlset object with preserved namespace attributes and the chunked urls
        const chunkObject = {
            urlset: {
                ...urlsetAttrs,
                url: chunk
            }
        };

        const chunkXml = builder.build(chunkObject);
        return new NextResponse(chunkXml, {
            status: 200,
            // headers: { 'Content-Type': 'application/xml' }
        });
    } catch (error) {
        console.error('Error generating sub-sitemap:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Helper from main route; duplicated here to avoid cross-file coupling.
const urlMatchesPattern = (url: string, pattern: string): boolean => {
    if (!pattern.includes('*') && !pattern.includes('**')) {
        return url === pattern;
    }
    let regexString = pattern
        .replace(/\*\*/g, '__GLOBSTAR__')
        .replace(/\*/g, '__WILDCARD__')
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/__GLOBSTAR__/g, '.*')
        .replace(/__WILDCARD__/g, '[^/]+');
    const finalRegexPattern = `^${regexString}$`;
    try {
        return new RegExp(finalRegexPattern).test(url);
    } catch {
        return false;
    }
};

export const dynamic = 'force-dynamic';
