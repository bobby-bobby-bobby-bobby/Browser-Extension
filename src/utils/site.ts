export function normalizedHost(locationLike: Location = window.location): string {
  return locationLike.hostname.replace(/^www\./, '').toLowerCase();
}

export function isSiteDisabled(disabledSites: string[], host = normalizedHost()): boolean {
  return disabledSites.some((site) => host === site || host.endsWith(`.${site}`));
}
