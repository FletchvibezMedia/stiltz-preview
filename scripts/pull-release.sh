#!/usr/bin/env bash
set -euo pipefail

origin='https://stiltz-florida-rescue-replica.carolina-qua-8173.chatgpt.site'
root="${1:-release-source}"

routes=(
  '' about-us best-choice-2017-elevator best-home-elevator-boca-raton build-down-installations compare contact-us
  costs-and-planning custom-colors elevator-installs-in-jacksonville existing-homes factory-brochures faqs
  finance-your-elevator gallery-of-installs-florida good-housekeeping-seal how-we-install-a-stiltz-residential-elevator
  installation its-official-we-are-stiltzofflorida-com landing-installations lift-finishes meet-the-team new-model-2018
  request-consultation stiltz-duo-alta-new-model stiltz-duo-classic stiltz-duo-thru-car stiltz-duo-vista stiltz-news
  stiltz-trio-alta-new-model stiltz-trio-alta-thru-car testimonials the-true-choice-in-home-elevators trio-alta-three-story videos
)

rm -rf "$root"
mkdir -p "$root"
for route in "${routes[@]}"; do
  destination="$root/${route:+$route/}index.html"
  mkdir -p "$(dirname "$destination")"
  curl -L --fail --silent --show-error --max-time 30 "$origin/${route:+$route/}" -o "$destination"
done

for file in static-navigation.js rescue-overrides.css favicon.svg; do
  curl -L --fail --silent --show-error --max-time 30 "$origin/$file" -o "$root/$file"
done

for file in \
  images/models/trio-alta-thru-car/client-install-01-clean.png \
  images/models/trio-alta-thru-car/client-install-02-clean.png \
  images/models/trio-alta-3-story/middle-level-enclosure-glass-clean.jpg \
  images/models/trio-alta-3-story/three-story-detail-03-clean.jpg \
  images/team/current/heather.png; do
  mkdir -p "$root/$(dirname "$file")"
  curl -L --fail --silent --show-error --max-time 30 "$origin/$file" -o "$root/$file"
done

# Download every local asset referenced by the released HTML/CSS/JS.
node scripts/download-assets.mjs "$root" "$origin"
