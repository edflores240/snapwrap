# SnapWrap 📸✨

A modern, beautiful photo booth web application built with Next.js and Supabase.

## Features

- 📷 **Live Camera Capture** - WebRTC-powered webcam integration
- 🎨 **Creative Templates** - Apply stunning frames and overlays to photos
- 📱 **QR Code Downloads** - Generate instant QR codes for mobile downloads
- ✨ **Modern UI** - Glassmorphism, gradients, and smooth animations
- ☁️ **Cloud Storage** - Photos stored securely in Supabase

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

Follow the instructions in `SUPABASE_SETUP.md` to:
- Create your Supabase project
- Set up database tables
- Configure storage bucket
- Add your credentials to `.env.local`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Modern styling
- **Supabase** - Database + file storage
- **Framer Motion** - Smooth animations
- **WebRTC** - Camera access

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── page.tsx           # Landing page
│   ├── booth/             # Photo booth flow
│   └── download/          # QR download pages
├── components/
│   ├── ui/                # Reusable UI components
│   ├── camera/            # Camera capture components
│   ├── templates/         # Template selection
│   └── qr/                # QR code generation
├── lib/
│   ├── supabase.ts        # Supabase client
│   └── database.types.ts  # TypeScript types
└── public/
    └── templates/         # Template overlay images
```

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Remember to add your environment variables in Vercel settings!

---

Made with ❤️ for capturing memories

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# snapwrap
