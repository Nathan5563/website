const PROBLEM_PATH = /^\/problems\/([a-zA-Z0-9]{5})\/?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(PROBLEM_PATH);

    if (match) {
      const lower = match[1].toLowerCase();
      if (match[1] !== lower) {
        url.pathname = `/problems/${lower}/`;
        return Response.redirect(url.toString(), 301);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
