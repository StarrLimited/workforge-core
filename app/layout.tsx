import type { Metadata } from 'next';
import './globals.css';
import './field.css';
import './brand.css';
export const metadata:Metadata={title:'WorkForge OS',description:'A business operating system built around your work.',robots:{index:false,follow:false},icons:{icon:'/brand/workforge-icon.png',apple:'/brand/workforge-icon.png'}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
