Site hero: quiet nature footage or photography under a scrim, with the copy set **directly on the image**.

```jsx
// Homepage — looping footage, flat scrim
<HeroPanel
  variant="video"
  backgroundVideo="/assets/video/Bodhi_Leaves-transcode.mp4"
  backgroundImage="/assets/images/Bodhi_Leaves-poster.jpg"
  heading={<>Awaken your Mind,<br/>Open your Heart,<br/>Nourish your Life,<br/>Beautify the World.</>}
  cta="Join us–today"
  secondary="See what's happening this week"
>
  RIM is a modern, welcoming Dharma center grounded in traditional Buddhist wisdom.
</HeroPanel>

// Inner page — still photograph, directional blue→navy scrim
<HeroPanel
  eyebrow="Embodied generosity"
  heading="Become a Volunteer"
  backgroundImage="/assets/images/Community-Hands-on-Tree.jpg"
  cta="Current needs"
/>
```

**No white panel.** The copy sits on the scrim. A 95%-opaque paper panel was the treatment through session 168 and was retired in 169: RIM heroes already carry a featured floating object on some pages (the program-detail quote card), and a second white rectangle on the same image read as clutter — the same reasoning that retired the floating nav pill. See `RIM_Public_Pages.md`.

The primary action is the **white pill** — a blue one disappears into the scrim. The secondary is a bare white label with a trailing arrow that nudges 4px on hover.

Copy is left-aligned. A centred variant was tried on the homepage in session 169 and rejected; the left-aligned dark treatment is the chosen one.
