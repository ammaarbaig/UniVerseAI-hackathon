# What UniVerse AI is

UniVerse is a static site that helps students navigate Rajasthan DTE (Directorate
of Technical Education) engineering and polytechnic admissions. It has a landing
page with a rank-based college predictor, and a chat page for asking admissions
questions in plain language.

**UniVerse is an independent project and is not affiliated with, endorsed by, or
in any way officially connected to the Government of Rajasthan or its DTE.**

## Stack

Plain static HTML/CSS/JS.

## Running locally
**Important:** `chat.html` loads the Zapier chatbot widget from a CDN via a
`type="module"` script tag. Browsers block ES module scripts on the `file://`
protocol, so `chat.html` must be served over http(s)

## Data

`assets/js/data.js` (colleges, cutoffs, FAQs) is generated from
`2026.08-College-Database-final.xlsx` researched by Ammaar Baig and team.
