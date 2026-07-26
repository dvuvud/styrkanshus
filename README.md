# StyrkansHus website

Plain HTML/CSS/JS, no build step or framework. Deploys straight to GitHub Pages.

## Structure
```
index.html       Hem
om-oss.html      Om oss (text + styrelsen already filled in)
evenemang.html   Kommande evenemang (placeholder cards)
sponsorer.html   Sponsorer (placeholder grid)
stod-oss.html    Stödj oss (placeholder donation/volunteer info)
kontakt.html     Kontakta oss (contact form + details)
css/style.css    All styling, colors/fonts as CSS variables at the top
js/main.js       Just the mobile nav toggle
images/logo.png  The logo
```

## Still to fill in
Search each page for the dashed purple boxes (`.todo`).

## Contact form
Wired to Web3Forms, still no backend needed. To activate it:
1. Go to https://web3forms.com/, enter the destination email address, and
   check your inbox for an access key (no account/login required).
2. Open `kontakt.html`, find the hidden `access_key` input near the top of
   the form, and paste the key in place of `YOUR_ACCESS_KEY_HERE`.
