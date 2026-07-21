import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";

export default function UserProfilePage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#f7f5f0] px-3 py-4 text-[#111111] sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1100px]">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium transition hover:border-black/25"
        >
          ← Вернуться в SSSWEAR AI
        </Link>

        <div className="flex w-full justify-center">
          <UserProfile
            routing="path"
            path="/user-profile"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full max-w-none",
              },
            }}
          />
        </div>
      </div>
    </main>
  );
}
