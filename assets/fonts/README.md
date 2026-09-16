# Brand typography

Mona Sans is bundled locally as a WOFF2 variable font, converted without subsetting from the official source at commit `0f7dc66ddd766605eb0e75c3f47bf9d1dd38ceca`:
https://github.com/github/mona-sans

Included axes: weight 200–900, width 75–125%, optical size, and italics. Widths cover Condensed (75%), Semi Condensed (87.5%), Normal (100%), Semi Expanded (112.5%), and Expanded (125%). The accompanying OFL license must remain with the font.

The homepage heading now uses Mona Sans Expanded Black (900 weight, 125% width), following the updated guide. Bell MT remains limited to optional large banners such as the officer sign-in banner. It currently uses the locally installed font, falling back to Mona Sans when unavailable. To guarantee Bell MT on every device, add the team's web-licensed WOFF2 file and update its `@font-face` source in `assets/brand.css` and the optional Admin branding snippet. Do not distribute an unlicensed desktop font.
