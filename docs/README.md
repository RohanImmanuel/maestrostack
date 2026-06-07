# MaestroStack site and documentation

This folder is the MaestroStack showcase site and documentation, built as a
static site for GitHub Pages.

## Structure

```text
docs/
  index.html          # showcase landing page
  docs.html           # documentation
  .nojekyll           # serve files as-is (no Jekyll processing)
  assets/
    css/style.css     # shared styles (palette, layout, components)
    css/docs.css      # documentation page styles
    js/main.js        # nav, parallax, reveals, terminal typing, copy
    js/docs.js        # docs scrollspy, table-of-contents, code copy
    img/favicon.svg
```

No build step and no dependencies. Plain HTML, CSS and JavaScript.

## Preview locally

Open `index.html` directly, or serve the folder so relative paths resolve:

```bash
npx serve docs
# or
python3 -m http.server --directory docs 8080
```

## Publish on GitHub Pages

1. Push the repo to GitHub.
2. Go to **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Choose the default branch and the **/docs** folder, then save.

The site will be available at `https://<user>.github.io/<repo>/`.

## Notes

- Update the GitHub links (currently `https://github.com/`) once the repository
  URL is known.
- Colours use the project palette: Ink Black `#0e1116`, Bright Lemon `#f4e409`,
  Scarlet Rush `#d64045`, Dark Cyan `#129490`, Ash Grey `#c6d8d3`.
- Animations respect `prefers-reduced-motion`.
