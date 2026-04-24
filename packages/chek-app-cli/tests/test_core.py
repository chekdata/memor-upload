from cli_anything.frontend_app.core import h5_url, route_config


def test_h5_url_uses_hash_route():
    assert h5_url("pages/vehicles/index/index", "http://localhost:10086/") == (
        "http://localhost:10086/#/pages/vehicles/index/index"
    )


def test_route_config_parses_app_config(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.config.ts").write_text(
        """
export default defineAppConfig({
  entryPagePath: 'pages/discovery/index',
  pages: [
    'pages/discovery/index',
    'pages/vehicles/index/index',
  ],
})
""",
        encoding="utf-8",
    )

    repo = tmp_path
    config = route_config(repo)
    assert config["entryPagePath"] == "pages/discovery/index"
    assert "pages/vehicles/index/index" in config["pages"]
    assert config["count"] == 2
