import type { GameItem } from "@/types/game";

export default function LotIllustration({ kind }: { kind: GameItem["templateId"] }) {
  return <svg className="lot-illustration" viewBox="0 0 300 210" fill="none" aria-hidden="true">
    <ellipse cx="150" cy="182" rx="107" ry="12" fill="currentColor" opacity=".07" />
    <circle cx="150" cy="99" r="83" stroke="currentColor" strokeDasharray="2 7" opacity=".16" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === "chest" && <>
        <path d="M55 100q4-47 95-47t95 47v64q-90 28-190 0z" fill="currentColor" fillOpacity=".06" />
        <path d="M55 100q92 23 190 0M55 115q92 23 190 0M92 62v113m116-112v112M72 84q75 22 157 0M111 56v60m77-60v60" />
        <path d="M135 111v29h29v-29m-14 10v10M72 137v15m156-15v15" /><circle cx="103" cy="156" r="2" /><circle cx="195" cy="156" r="2" />
      </>}
      {kind === "painting" && <>
        <path d="M67 37h166v139H67zM76 46h148v121H76zM87 57h126v99H87z" fill="currentColor" fillOpacity=".04" />
        <path d="m88 136 29-24 34 13 24-39 38 50M88 143h124M95 151h106m-34-36h30m-92-40h33m-19-6h29" /><circle cx="123" cy="87" r="10" />
        <path d="m67 37 20 20m146-20-20 20M67 176l20-20m146 20-20-20" />
      </>}
      {kind === "footlocker" && <>
        <path d="m53 81 136-20 61 30v76l-143 20-54-33z" fill="currentColor" fillOpacity=".06" />
        <path d="m53 81 54 30 143-20m-143 20v76M53 97l54 31 143-20M78 68l55 32v82m62-119 29 16v92m-95-29 31-4v10l-31 4z" />
        <path d="m66 117 24 13m-24 9 24 13m94-29 40-6m-40 15 27-4" strokeDasharray="4 4" />
      </>}
      {kind === "telescope" && <>
        <path d="m72 92 135-51 16 39-135 51z" fill="currentColor" fillOpacity=".07" />
        <path d="m207 41 8-3 16 39-8 3M76 93l14 36m18-48 16 36m62-68 16 38m-53 21v29m-8 0h17l48 53m-57-53-48 53m48-53v53M66 99l-14 5 9 23 17-6" />
        <circle cx="150" cy="112" r="6" />
      </>}
      {kind === "cabinet" && <>
        <path d="M89 36h124v134H89z" fill="currentColor" fillOpacity=".06" /><path d="M84 28h134v8H84zm12 17h109v35H96zm0 44h109v34H96zm0 43h109v29H96zm-7 38v12h13v-12m98 0v12h13v-12" />
        <path d="m150 50 3 8 9 1-7 6 2 9-7-5-7 5 2-9-7-6 9-1zm-10 55h21m-21 42h21" />
      </>}
    </g>
    <path d="M33 35h13m-6-6v13m208 108h12m-6-6v12" stroke="currentColor" opacity=".3" />
  </svg>;
}
