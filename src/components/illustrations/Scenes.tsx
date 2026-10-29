// Preact twins of HeroScene.astro, HandoutStack.astro, and VisitSpot.astro (same drawings), so the
// landing page can be drawn by the shared block renderer in the browser. All are decorative.
import type { BuiltinPicture } from '../../lib/homePage';

export function HeroScene() {
  return (
    <svg class="ill" viewBox="0 0 560 470" aria-hidden="true" focusable="false">
  <circle class="c-tint" cx="290" cy="245" r="215" />
  <circle class="c-sun" cx="478" cy="78" r="34" />
  <circle class="c-sun-soft" cx="70" cy="98" r="22" />

  {/* Tablet with a slide: "Learn it" */}
  <rect class="c-forest-deep" x="44" y="96" width="318" height="222" rx="28" />
  <rect class="c-cream" x="62" y="114" width="282" height="186" rx="16" />
  <rect class="c-forest" x="86" y="140" width="150" height="18" rx="9" />
  <circle class="c-sun" cx="310" cy="149" r="16" />
  <rect class="c-rule" x="86" y="178" width="120" height="10" rx="5" />
  <rect class="c-rule" x="86" y="198" width="100" height="10" rx="5" />
  <rect class="c-rule" x="86" y="218" width="110" height="10" rx="5" />
  <rect class="c-tint" x="220" y="174" width="104" height="104" rx="14" />
  <path class="s-forest" d="M246 248 L268 222 L284 238 L298 220" />
  <circle class="c-forest" cx="250" cy="200" r="9" />

  {/* Large-print handout: "Keep it" */}
  <g transform="rotate(-7 190 380)">
    <rect class="c-paper s-rule" x="96" y="306" width="186" height="146" rx="14" />
    <rect class="c-forest" x="116" y="326" width="96" height="14" rx="7" />
    <rect class="c-rule" x="116" y="352" width="140" height="9" rx="4.5" />
    <rect class="c-rule" x="116" y="370" width="120" height="9" rx="4.5" />
    <rect class="c-sun-soft" x="116" y="392" width="146" height="42" rx="10" />
    <path class="s-forest" d="M130 413 l9 9 l17 -19" />
    <rect class="c-rule" x="170" y="408" width="78" height="9" rx="4.5" />
  </g>

  {/* Phone with a call screen and the green call button: "Try it" */}
  <rect class="c-ink" x="330" y="138" width="160" height="306" rx="30" />
  <rect class="c-paper" x="343" y="156" width="134" height="270" rx="18" />
  <circle class="c-tint" cx="410" cy="222" r="34" />
  <circle class="c-forest" cx="410" cy="212" r="12" />
  <path class="c-forest" d="M388 244 a22 18 0 0 1 44 0 z" />
  <rect class="c-forest" x="374" y="272" width="72" height="12" rx="6" />
  <rect class="c-rule" x="384" y="294" width="52" height="9" rx="4.5" />
  <circle class="s-sun" cx="410" cy="370" r="40" />
  <circle class="c-forest" cx="410" cy="370" r="28" />
  <path class="c-paper" d="M399 357 c3-3 7-3 9 0 l3 4 c2 3 1 6-1 8 l-2 2 c2 5 6 9 11 11 l2-2 c2-2 5-3 8-1 l4 3 c3 2 3 6 0 9 l-3 3 c-4 4-12 2-20-6 c-8-8-10-16-6-20 z" />

  {/* A friendly "done" bubble */}
  <path class="c-forest" d="M452 132 h72 a18 18 0 0 1 18 18 v26 a18 18 0 0 1 -18 18 h-44 l-16 14 v-14 h-12 a18 18 0 0 1 -18 -18 v-26 a18 18 0 0 1 18 -18 z" />
  <path class="s-paper" d="M474 165 l11 11 l22 -24" />
</svg>
  );
}

export function HandoutStack() {
  return (
    <svg class="ill" viewBox="0 0 480 340" aria-hidden="true" focusable="false">
  <circle class="c-tint" cx="250" cy="180" r="150" />
  <circle class="c-sun" cx="78" cy="62" r="20" />
  <g transform="rotate(-12 180 190)">
    <rect class="c-paper s-rule" x="96" y="70" width="170" height="220" rx="14" />
    <rect class="c-rule" x="116" y="96" width="110" height="12" rx="6" />
    <rect class="c-rule" x="116" y="124" width="126" height="9" rx="4.5" />
  </g>
  <g transform="rotate(5 300 190)">
    <rect class="c-paper s-rule" x="214" y="64" width="170" height="220" rx="14" />
    <rect class="c-rule" x="234" y="90" width="110" height="12" rx="6" />
    <rect class="c-rule" x="234" y="118" width="126" height="9" rx="4.5" />
  </g>
  <rect class="c-paper s-rule" x="150" y="56" width="180" height="236" rx="14" />
  <rect class="c-forest" x="172" y="80" width="100" height="16" rx="8" />
  <rect class="c-rule" x="172" y="112" width="134" height="10" rx="5" />
  <rect class="c-rule" x="172" y="132" width="116" height="10" rx="5" />
  <rect class="c-rule" x="172" y="152" width="126" height="10" rx="5" />
  <rect class="c-sun-soft" x="172" y="184" width="136" height="74" rx="12" />
  <path class="s-forest" d="M188 222 l11 11 l21 -24" />
  <rect class="c-rule" x="232" y="214" width="62" height="10" rx="5" />
  <circle class="c-forest" cx="356" cy="266" r="40" />
  <path class="s-paper" d="M356 246 v34 M342 268 l14 14 l14 -14" />
</svg>
  );
}

export function VisitSpot({ kind }: { kind: 'learn' | 'try' | 'keep' }) {
  return (
    <svg class="ill spot" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
      {kind === 'learn' && (
        <>
        <rect class="c-forest-deep" x="78" y="18" width="164" height="104" rx="16" />
        <rect class="c-cream" x="88" y="28" width="144" height="84" rx="9" />
        <rect class="c-forest" x="102" y="42" width="78" height="11" rx="5.5" />
        <rect class="c-rule" x="102" y="64" width="64" height="8" rx="4" />
        <rect class="c-rule" x="102" y="80" width="54" height="8" rx="4" />
        <circle class="c-sun" cx="206" cy="84" r="14" />
        <rect class="c-muted" x="148" y="122" width="24" height="12" />
        <rect class="c-muted" x="126" y="132" width="68" height="8" rx="4" />
      </>
      )}
      {kind === 'try' && (
        <>
        <rect class="c-ink" x="122" y="12" width="76" height="130" rx="16" />
        <rect class="c-paper" x="130" y="22" width="60" height="110" rx="10" />
        <rect class="c-rule" x="140" y="36" width="40" height="8" rx="4" />
        <rect class="c-rule" x="140" y="52" width="30" height="8" rx="4" />
        <circle class="s-sun" cx="160" cy="98" r="20" />
        <circle class="c-forest" cx="160" cy="98" r="12" />
        <path class="c-forest" d="M214 30 h52 a14 14 0 0 1 14 14 v22 a14 14 0 0 1 -14 14 h-30 l-14 12 v-12 h-8 a14 14 0 0 1 -14 -14 v-22 a14 14 0 0 1 14 -14 z" />
        <path class="s-paper" d="M228 56 l8 8 l17 -18" />
        <circle class="c-sun" cx="84" cy="40" r="12" />
      </>
      )}
      {kind === 'keep' && (
        <>
        <g transform="rotate(-6 160 75)">
          <rect class="c-paper s-rule" x="104" y="12" width="112" height="128" rx="10" />
          <rect class="c-forest" x="118" y="26" width="60" height="10" rx="5" />
          <rect class="c-rule" x="118" y="46" width="84" height="7" rx="3.5" />
          <rect class="c-rule" x="118" y="60" width="70" height="7" rx="3.5" />
          <rect class="c-sun-soft" x="118" y="80" width="86" height="42" rx="8" />
          <path class="s-forest" d="M128 101 l7 7 l13 -15" />
        </g>
        <circle class="c-sun" cx="244" cy="30" r="12" />
      </>
      )}
    </svg>
  );
}

/** A built-in drawing by name. */
export function BuiltinScene({ name }: { name: BuiltinPicture }) {
  if (name === 'hero') return <HeroScene />;
  if (name === 'handouts') return <HandoutStack />;
  return <VisitSpot kind={name} />;
}
