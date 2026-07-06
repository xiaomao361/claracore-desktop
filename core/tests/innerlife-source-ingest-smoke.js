const fs = require("fs/promises");
const http = require("http");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function feed(items) {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>InnerLife Test Feed</title>
    ${items.map((item) => `
    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <pubDate>${item.pubDate}</pubDate>
      <description>${item.description}</description>
    </item>`).join("")}
  </channel>
</rss>`;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-innerlife-source-ingest-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const oldEnv = {
    HTTP_PROXY: process.env.HTTP_PROXY,
    http_proxy: process.env.http_proxy,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    https_proxy: process.env.https_proxy,
    ALL_PROXY: process.env.ALL_PROXY,
    all_proxy: process.env.all_proxy,
    NO_PROXY: process.env.NO_PROXY,
    no_proxy: process.env.no_proxy
  };
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  const feedServer = http.createServer((req, res) => {
    if (req.url !== "/feed.xml") {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
    res.end(feed([
      {
        title: "Desktop InnerLife source ingest one",
        link: "https://example.com/innerlife-one",
        pubDate: "Mon, 06 Jul 2026 10:00:00 GMT",
        description: "The first source item should become pending inbox material."
      },
      {
        title: "Desktop InnerLife source ingest two",
        link: "https://example.com/innerlife-two",
        pubDate: "Mon, 06 Jul 2026 11:00:00 GMT",
        description: "The second source item should also become pending inbox material."
      }
    ]));
  });
  const feedPort = await listen(feedServer);

  const proxyHits = [];
  const proxyServer = http.createServer((req, res) => {
    proxyHits.push(req.url);
    if (req.url !== "http://source.test/feed.xml") {
      res.writeHead(502);
      res.end("unexpected proxy target");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
    res.end(feed([
      {
        title: "Proxy sourced InnerLife update",
        link: "https://example.com/proxy-innerlife",
        pubDate: "Mon, 06 Jul 2026 12:00:00 GMT",
        description: "A proxied source item should be fetched through HTTP_PROXY."
      }
    ]));
  });
  const proxyPort = await listen(proxyServer);

  try {
    process.env.HTTP_PROXY = "";
    process.env.http_proxy = "";
    process.env.HTTPS_PROXY = "";
    process.env.https_proxy = "";
    process.env.ALL_PROXY = "";
    process.env.all_proxy = "";
    process.env.NO_PROXY = "127.0.0.1,localhost";
    process.env.no_proxy = "127.0.0.1,localhost";

    await runtime.saveProductSettings(app, { "innerlife.provider": "disabled" });
    const { database } = await runtime.ensureProductCore(app);
    await database.updateInnerLifeProfile({
      agentId: "my-agent",
      profile: {
        identity: { role: "source ingest smoke" },
        autonomous_sources: [
          {
            name: "Local Feed",
            url: `http://127.0.0.1:${feedPort}/feed.xml`,
            source_type: "rss"
          }
        ]
      }
    });

    const first = await database.ingestInnerLifeSources({ agentId: "my-agent" });
    if (first.insertedCount !== 2 || first.errors.length !== 0) {
      throw new Error(`Expected two direct feed inbox items: ${JSON.stringify(first)}`);
    }
    const duplicate = await database.ingestInnerLifeSources({ agentId: "my-agent" });
    if (duplicate.insertedCount !== 0) {
      throw new Error(`Source ingest should dedupe repeated feed items: ${JSON.stringify(duplicate)}`);
    }
    const explore = await database.exploreInnerLife({ agentId: "my-agent", ingestSources: true });
    if (!explore.share?.body.includes("Desktop InnerLife source ingest")) {
      throw new Error("Explore did not include source-ingested inbox material.");
    }

    process.env.HTTP_PROXY = `http://127.0.0.1:${proxyPort}`;
    process.env.NO_PROXY = "";
    process.env.no_proxy = "";
    await database.updateInnerLifeProfile({
      agentId: "my-agent",
      profile: {
        identity: { role: "source ingest smoke" },
        autonomous_sources: [
          {
            name: "Proxy Feed",
            url: "http://source.test/feed.xml",
            source_type: "rss"
          }
        ]
      }
    });
    const proxied = await database.ingestInnerLifeSources({ agentId: "my-agent" });
    if (proxied.insertedCount !== 1 || proxyHits.length !== 1) {
      throw new Error(`Source ingest did not use HTTP_PROXY: ${JSON.stringify({ proxied, proxyHits })}`);
    }

    const inbox = await database.listInnerLifeInboxPage({ agentId: "my-agent", status: "pending", limit: 10 });
    if (!inbox.items.some((item) => item.body.includes("Proxy sourced InnerLife update"))) {
      throw new Error("Proxied source item was not saved to pending inbox.");
    }

    console.log(JSON.stringify({ ok: true, dataRoot, directInserted: first.insertedCount, proxiedInserted: proxied.insertedCount }, null, 2));
  } finally {
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await close(feedServer);
    await close(proxyServer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
