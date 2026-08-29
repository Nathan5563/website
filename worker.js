const PUZZLE_PATH = /^\/puzzles\/([a-zA-Z0-9]{5})\/?$/;
const LEGACY_PROBLEM_PATH = /^\/problems(?:\/([a-zA-Z0-9]{5}))?\/?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const legacy = url.pathname.match(LEGACY_PROBLEM_PATH);
    if (legacy) {
      url.pathname = legacy[1] ? `/puzzles/${legacy[1].toLowerCase()}/` : "/puzzles/";
      return Response.redirect(url.toString(), 301);
    }

    const match = url.pathname.match(PUZZLE_PATH);
    if (match) {
      const lower = match[1].toLowerCase();
      if (match[1] !== lower) {
        url.pathname = `/puzzles/${lower}/`;
        return Response.redirect(url.toString(), 301);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
