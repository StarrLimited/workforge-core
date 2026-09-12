import Image from 'next/image';

/** Frames the supplied artwork without modifying or redrawing the logo. */
export default function BrandLogo({plate = false}: {plate?: boolean}) {
  return <span className={plate ? 'brand-plate' : 'brand-lockup'}>
    <span className="brand-logo">
      <Image src="/brand/workforge-wordmark.png" alt="WorkForge" width={1536} height={1024} sizes="(max-width: 640px) 300px, 420px" loading="eager"/>
    </span>
  </span>;
}
