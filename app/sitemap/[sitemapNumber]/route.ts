import { NextRequest, NextResponse } from 'next/server';
import {
    readConfig,
    fetchAndParseSource,
    preserveUrlsetAttrs,
    applyRemovals,
    applyAdditions,
    applyDomainReplace,
    buildUrlsetXml,
    sliceChunk
} from '../../sitemap.xml/utils';

export async function GET(request: NextRequest, context: { params: { sitemapNumber: string } }) {
    try {
        const pageParam = (await context.params)?.sitemapNumber.replace('.xml', '');
        const pageNumber = parseInt(pageParam, 10);
        if (!Number.isFinite(pageNumber) || pageNumber < 1) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const { sourceSitemapUrl, urlsToRemove, urlsToAdd, domainToReplace, originDomain, sitemapLimit } = await readConfig();

        const sitemapObject = await fetchAndParseSource(sourceSitemapUrl);
        if (!(sitemapObject.urlset && sitemapObject.urlset.url)) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const urlsetAttrs = preserveUrlsetAttrs(sitemapObject.urlset);

        let urls = sitemapObject.urlset.url;
        urls = applyRemovals(urls, urlsToRemove);
        urls = applyAdditions(urls, urlsToAdd);
        urls = applyDomainReplace(urls, originDomain, domainToReplace);

        const startIndex = (pageNumber - 1) * sitemapLimit;
        if (startIndex >= urls.length) {
            return new NextResponse('Not Found', { status: 404 });
        }
        const chunk = sliceChunk(urls, pageNumber, sitemapLimit);

        const chunkXml = buildUrlsetXml(chunk, urlsetAttrs);
        return new NextResponse(chunkXml, {
            status: 200,
        });
    } catch (error) {
        console.error('Error generating sub-sitemap:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
