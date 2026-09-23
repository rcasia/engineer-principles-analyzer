// Redirects the distribution's default (*.cloudfront.net) domain to the
// canonical custom domain (ADR-0041). Viewer-request trigger, so it runs
// before the cache: once the alias exists, the default domain never serves
// content, it only 301s. Kept ES5-style: CloudFront Functions reject syntax
// outside their supported subset, and plain `var` plus Array methods are
// always safe.
function handler(event) {
  var request = event.request;
  var host = request.headers.host.value;
  if (host.slice(-14) === ".cloudfront.net") {
    var location = "https://${canonical_host}" + request.uri;
    var names = Object.keys(request.querystring);
    if (names.length > 0) {
      location +=
        "?" +
        names
          .map(function (name) {
            return name + "=" + request.querystring[name].value;
          })
          .join("&");
    }
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: { location: { value: location } },
    };
  }
  return request;
}
