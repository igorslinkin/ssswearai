"use client";

import { useEffect, useMemo, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

type Mode =
  | "cyclorama"
  | "product"
  | "creative"
  | "image"
  | "mobile"
  | "tryon";

type Ratio = "4:5" | "3:4" | "9:16" | "1:1" | "2:3";

const modes: { value: Mode; title: string; description: string }[] = [
  { value: "cyclorama", title: "Cyclorama", description: "Clean studio background" },
  { value: "product", title: "Product", description: "Marketplace-ready frame" },
  { value: "creative", title: "Creative", description: "Bold visual concept" },
  { value: "image", title: "Campaign", description: "Editorial brand mood" },
  { value: "mobile", title: "Mobile", description: "Realistic UGC photo" },
  { value: "tryon", title: "Try-on", description: "Model wearing garment" },
];

const ratios: Ratio[] = ["4:5", "3:4", "9:16", "1:1", "2:3"];

async function compressImage(file: File, maxSize = 1400, quality = 0.82) {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.round(imageBitmap.width * scale);
  const height = Math.round(imageBitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");

  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Image compression failed."));
      },
      "image/jpeg",
      quality
    );
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-compressed.jpg", {
    type: "image/jpeg",
  });
}

function formatFileSize(file: File) {
  return `${(file.size / 1024 / 1024).toFixed(2)} MB`;
}

export default function Page() {
  const { isSignedIn, isLoaded } = useUser();

  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);

  const [mode, setMode] = useState<Mode>("cyclorama");
  const [aspectRatio, setAspectRatio] = useState<Ratio>("4:5");
  const [userPrompt, setUserPrompt] = useState("");

  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!isSignedIn) {
        setCredits(null);
        return;
      }

      try {
        setCreditsLoading(true);

        const res = await fetch("/api/me");
        const data = await res.json();

        if (data.success) {
          setCredits(data.profile.credits);
        }
      } catch {
        setCredits(null);
      } finally {
        setCreditsLoading(false);
      }
    }

    loadProfile();
  }, [isSignedIn]);

  const uploadedCount = useMemo(() => {
    return Number(Boolean(frontFile)) + Number(Boolean(backFile)) + detailFiles.length;
  }, [frontFile, backFile, detailFiles]);

  const handleGenerate = async () => {
    if (!isSignedIn) {
      setError("Please sign in to generate images.");
      return;
    }

    if (!frontFile) {
      setError("Upload FRONT photo first.");
      return;
    }

    setLoading(true);
    setError("");
    setImage("");

    try {
      const formData = new FormData();

      const compressedFront = await compressImage(frontFile);
      formData.append("front", compressedFront);

      if (backFile) {
        const compressedBack = await compressImage(backFile);
        formData.append("back", compressedBack);
      }

      for (const file of detailFiles) {
        const compressedDetail = await compressImage(file);
        formData.append("details", compressedDetail);
      }

      formData.append("mode", mode);
      formData.append("aspectRatio", aspectRatio);
      formData.append("userPrompt", userPrompt);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Generation failed.");
        return;
      }

      setImage(data.image);
    } catch (err: any) {
      setError(err?.message || "API request failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f5f0] text-[#111111]">
        <p className="text-sm text-black/50">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#111111]">
      <header className="border-b border-black/10 bg-[#f7f5f0]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5">
          <div>
            <div className="text-sm font-semibold tracking-[0.22em]">SSSWEAR AI</div>
            <div className="mt-1 text-xs text-black/50">
              Professional fashion photography from your garment
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-black/55 md:flex">
            <button className="text-black">Studio</button>
            <button>History</button>
            <button>Credits</button>
            <button>Account</button>
          </nav>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm">
                  {creditsLoading
                    ? "Loading Credits"
                    : `${credits ?? 0} Credits`}
                </div>
                <UserButton />
              </>
            ) : (
              <SignInButton mode="modal">
                <button className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white">
                  Sign in
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      {!isSignedIn ? (
        <section className="mx-auto flex min-h-[calc(100vh-90px)] max-w-[980px] items-center justify-center px-6 py-20">
          <div className="rounded-[36px] border border-black/10 bg-white p-10 text-center shadow-[0_30px_90px_rgba(0,0,0,0.08)]">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black text-3xl text-white">
              ✦
            </div>

            <h1 className="text-5xl font-semibold tracking-[-0.06em]">
              Create fashion photos from your garment.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-black/55">
              Upload front, back and detail photos of your product. Generate premium AI fashion
              photography for campaigns, marketplaces and social media.
            </p>

            <SignInButton mode="modal">
              <button className="mt-8 rounded-2xl bg-black px-7 py-4 text-sm font-semibold text-white transition hover:bg-black/85">
                Sign in to start
              </button>
            </SignInButton>

            <p className="mt-4 text-xs text-black/40">Email-only access. No Google login.</p>
          </div>
        </section>
      ) : (
        <section className="mx-auto grid max-w-[1440px] gap-6 px-6 py-6 lg:grid-cols-[520px_1fr]">
          <aside className="space-y-5">
            <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold tracking-[-0.04em]">New generation</h1>
                  <p className="mt-2 text-sm leading-6 text-black/55">
                    Upload garment photos, choose a shooting mode and create one premium AI fashion
                    image.
                  </p>
                </div>

                <div className="rounded-full bg-black px-3 py-1 text-xs text-white">
                  {uploadedCount} files
                </div>
              </div>

              <div className="grid gap-3">
                <UploadCard
                  title="FRONT"
                  description="Main front view of the garment"
                  file={frontFile}
                  onChange={setFrontFile}
                  required
                />

                <UploadCard
                  title="BACK"
                  description="Back view helps preserve construction"
                  file={backFile}
                  onChange={setBackFile}
                />

                <DetailsUpload files={detailFiles} onChange={setDetailFiles} />
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
              <SectionTitle title="Photo type" subtitle="Choose the production context" />

              <div className="mt-4 grid grid-cols-2 gap-3">
                {modes.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setMode(item.value)}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      mode === item.value
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-[#fbfaf7] hover:border-black/25",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div
                      className={[
                        "mt-1 text-xs leading-5",
                        mode === item.value ? "text-white/65" : "text-black/45",
                      ].join(" ")}
                    >
                      {item.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
              <SectionTitle title="Format" subtitle="Final image aspect ratio" />

              <div className="mt-4 flex flex-wrap gap-2">
                {ratios.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={[
                      "rounded-full border px-5 py-3 text-sm transition",
                      aspectRatio === ratio
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-[#fbfaf7] hover:border-black/25",
                    ].join(" ")}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
              <SectionTitle title="Additional instructions" subtitle="Optional creative direction" />

              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Example: natural daylight, summer mood, realistic skin texture, street location, shot on iPhone"
                rows={5}
                className="mt-4 w-full resize-none rounded-2xl border border-black/10 bg-[#fbfaf7] p-4 text-sm leading-6 outline-none transition placeholder:text-black/35 focus:border-black/30"
              />

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="mt-5 w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/35"
              >
                {loading ? "Preparing photos and generating..." : "Generate photo"}
              </button>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          </aside>

          <section className="min-h-[calc(100vh-120px)] rounded-[32px] border border-black/10 bg-[#111111] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
            <div className="flex h-full min-h-[720px] flex-col rounded-[24px] bg-[#181818]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <div className="text-sm font-medium text-white">Preview</div>
                  <div className="mt-1 text-xs text-white/40">
                    Result appears here after generation
                  </div>
                </div>

                <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                  {aspectRatio}
                </div>
              </div>

              <div className="flex flex-1 items-center justify-center p-6">
                {loading && (
                  <div className="max-w-sm text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border border-white/20 border-t-white" />
                    <div className="mt-5 text-sm font-medium text-white">
                      Creating fashion image
                    </div>
                    <div className="mt-2 text-sm leading-6 text-white/40">
                      We compress your photos and generate one premium result. This can take about a
                      minute.
                    </div>
                  </div>
                )}

                {!loading && !image && (
                  <div className="max-w-md text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl">
                      ✦
                    </div>
                    <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">
                      Your generated photo will appear here.
                    </h2>
                    <p className="mt-4 text-sm leading-6 text-white/40">
                      Upload at least the front image, choose the production mode and start
                      generation.
                    </p>
                  </div>
                )}

                {!loading && image && (
                  <div className="w-full max-w-[760px]">
                    <img
                      src={image}
                      alt="Generated result"
                      className="w-full rounded-[24px] object-contain shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
                    />

                    <div className="mt-5 flex justify-center gap-3">
                      <a
                        href={image}
                        download="ssswear-ai-generation.png"
                        className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black"
                      >
                        Download
                      </a>

                      <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-black/80">
        {title}
      </h2>
      <p className="mt-1 text-sm text-black/45">{subtitle}</p>
    </div>
  );
}

function UploadCard({
  title,
  description,
  file,
  onChange,
  required,
}: {
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-black/15 bg-[#fbfaf7] p-4 transition hover:border-black/35">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>
            {required && (
              <div className="rounded-full bg-black px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white">
                Required
              </div>
            )}
          </div>
          <div className="mt-1 text-xs text-black/45">{description}</div>

          {file && (
            <div className="mt-3 text-xs text-black/65">
              ✅ {file.name} — {formatFileSize(file)}
            </div>
          )}
        </div>

        <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium">
          Upload
        </div>
      </div>
    </label>
  );
}

function DetailsUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-black/15 bg-[#fbfaf7] p-4 transition hover:border-black/35">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onChange(Array.from(e.target.files || []))}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">DETAILS</div>
          <div className="mt-1 text-xs text-black/45">
            Add labels, tags, embroidery or close-up details
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-black/65">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`}>
                  ✅ {file.name} — {formatFileSize(file)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium">
          Add files
        </div>
      </div>
    </label>
  );
}