type AttachmentSource = {
    attachment_url?: string | null;
    attachment_urls?: string[] | null;
};

export function getPostAttachmentUrls(source: AttachmentSource) {
    const urls = Array.isArray(source.attachment_urls)
        ? source.attachment_urls
        : [];
    const cleanUrls = urls.map(url => String(url || '').trim()).filter(Boolean);
    const legacyUrl = String(source.attachment_url || '').trim();

    if (cleanUrls.length > 0) {
        return Array.from(new Set(cleanUrls));
    }

    return legacyUrl ? [legacyUrl] : [];
}

export function getPostPrimaryAttachmentUrl(source: AttachmentSource) {
    return getPostAttachmentUrls(source)[0] || '';
}
