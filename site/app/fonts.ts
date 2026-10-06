import { Doto, Martian_Mono, Rethink_Sans } from 'next/font/google';

// One set for the site, the docs and the 404 page, which each have their own root layout.
export const doto = Doto({
  subsets: ['latin'],
  variable: '--font-doto',
  weight: ['800', '900'],
});
export const rethink = Rethink_Sans({
  subsets: ['latin'],
  variable: '--font-rethink',
});
export const martian = Martian_Mono({
  subsets: ['latin'],
  variable: '--font-martian',
});

export const fontClasses = `${doto.variable} ${rethink.variable} ${martian.variable}`;
