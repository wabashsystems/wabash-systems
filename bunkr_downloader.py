# ======== AUTO-ADDED: GENERIC + ADVANCED DOWNLOADERS ========

class GenericVideoDownloader:
    def __init__(self, output_dir, dry_run=False, **kwargs):
        from pathlib import Path
        import requests
        self.output_dir = Path(output_dir)
        self.session = requests.Session()

    def extract_video_links(self, url):
        import re
        from bs4 import BeautifulSoup
        from urllib.parse import urljoin

        r = self.session.get(url)
        soup = BeautifulSoup(r.text, "html.parser")

        links = set()

        for v in soup.find_all("video"):
            if v.get("src"):
                links.add(urljoin(url, v["src"]))
            for s in v.find_all("source"):
                if s.get("src"):
                    links.add(urljoin(url, s["src"]))

        for a in soup.find_all("a", href=True):
            if a["href"].lower().endswith((".mp4",".webm",".mkv",".mov")):
                links.add(urljoin(url, a["href"]))

        links.update(re.findall(r'https?://[^\s"\']+\.mp4', r.text))
        return list(links)

    def download_page(self, url):
        import requests
        self.output_dir.mkdir(parents=True, exist_ok=True)

        success = failed = 0
        for link in self.extract_video_links(url):
            try:
                name = link.split("/")[-1].split("?")[0]
                path = self.output_dir / name
                r = requests.get(link, stream=True)
                with open(path, "wb") as f:
                    for c in r.iter_content(262144):
                        f.write(c)
                success += 1
            except:
                failed += 1

        return success, failed, 0


class AdvancedDownloader:
    def __init__(self, output_dir, headless=True, **kwargs):
        from pathlib import Path
        self.output_dir = Path(output_dir)
        self.headless = headless

    def download_page(self, url):
        from playwright.sync_api import sync_playwright
        import requests, os

        self.output_dir.mkdir(parents=True, exist_ok=True)
        urls = set()

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            page = browser.new_page()

            def capture(resp):
                if any(x in resp.url for x in [".mp4",".m3u8",".webm"]):
                    urls.add(resp.url)

            page.on("response", capture)
            page.goto(url, timeout=60000)
            page.wait_for_timeout(6000)
            browser.close()

        success = failed = 0

        for u in urls:
            try:
                name = u.split("/")[-1].split("?")[0]
                path = self.output_dir / name

                if ".m3u8" in u:
                    os.system(f'ffmpeg -y -i "{u}" -c copy "{path}.mp4"')
                else:
                    r = requests.get(u, stream=True)
                    with open(path, "wb") as f:
                        for c in r.iter_content(262144):
                            f.write(c)

                success += 1
            except:
                failed += 1

        return success, failed, 0

# ======== END AUTO-ADDED ========
