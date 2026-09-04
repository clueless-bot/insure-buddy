"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Download,
  ImageIcon,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCcw,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { generateTemplate1ImageClient } from "@/template_1_client";
import { TEMPLATE_1_URLS } from "@/template_1_urls";

type Status = "idle" | "generating" | "ready" | "error";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function Home() {
  const [profile, setProfile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (profilePreview) URL.revokeObjectURL(profilePreview);
    };
  }, [profilePreview]);

  useEffect(() => {
    return () => {
      if (resultPreview) URL.revokeObjectURL(resultPreview);
    };
  }, [resultPreview]);

  function selectProfile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStatus("error");
      setMessage("Please choose a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("error");
      setMessage("Please choose an image smaller than 10 MB.");
      return;
    }

    if (profilePreview) URL.revokeObjectURL(profilePreview);
    setProfile(file);
    setProfilePreview(URL.createObjectURL(file));
    setStatus("idle");
    setMessage("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) selectProfile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) selectProfile(file);
  }

  function downloadResult(url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = "insurebuddy-poster.jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      setStatus("error");
      setMessage("Add a profile image to continue.");
      inputRef.current?.focus();
      return;
    }

    setStatus("generating");
    setMessage("");

    try {
      const blob = await generateTemplate1ImageClient({
        profileImage: profile,
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        onModelProgress: (percent) => {
          setMessage(`Loading the local AI model… ${percent}%`);
        },
      });
      if (resultPreview) URL.revokeObjectURL(resultPreview);
      const resultUrl = URL.createObjectURL(blob);
      setResultPreview(resultUrl);
      setStatus("ready");
      setMessage("Your poster was created privately in your browser and downloaded.");
      downloadResult(resultUrl);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="InsureBuddy Studio home">
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.4} /></span>
          <span>InsureBuddy <strong>Studio</strong></span>
        </a>
        <span className="header-note"><span className="status-dot" /> Private, in-browser generation</span>
      </header>

      <section className="hero" id="top">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <span className="eyebrow"><Sparkles size={15} /> Poster generator</span>
          <h1>Your professional poster, <span>ready in moments.</span></h1>
          <p>Upload a portrait, add your details, and get a polished onboarding poster made for sharing.</p>
          <div className="trust-row">
            <span><Check size={15} /> Background removed</span>
            <span><Check size={15} /> Perfectly aligned</span>
            <span><Check size={15} /> High-resolution JPG</span>
          </div>
        </motion.div>
      </section>

      <section className="studio-shell">
        <motion.form
          className="form-card"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          <div className="section-heading">
            <span className="step-number">01</span>
            <div><h2>Add your details</h2><p>Use a clear, front-facing portrait for the best result.</p></div>
          </div>

          <div
            className={`upload-zone ${dragging ? "is-dragging" : ""} ${profile ? "has-file" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="sr-only"
            />
            <AnimatePresence mode="wait">
              {profilePreview ? (
                <motion.div className="selected-file" key="selected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profilePreview} alt="Selected profile preview" />
                  <div><strong>{profile?.name}</strong><span>Click or drop to replace</span></div>
                  <span className="file-check"><Check size={17} /></span>
                </motion.div>
              ) : (
                <motion.div className="upload-empty" key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="upload-icon"><UploadCloud size={24} /></span>
                  <div><strong>Drop your profile photo here</strong><span>or click to browse · PNG, JPG, WebP up to 10 MB</span></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <label className="field-label" htmlFor="phoneNumber">Phone number</label>
          <div className="input-shell">
            <Phone size={18} />
            <input id="phoneNumber" name="phoneNumber" type="tel" inputMode="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="e.g. 98255 71289" autoComplete="tel" required minLength={7} maxLength={20} />
          </div>

          <label className="field-label" htmlFor="email">Email address</label>
          <div className="input-shell">
            <Mail size={18} />
            <input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required maxLength={120} />
          </div>

          <motion.button className="generate-button" type="submit" disabled={status === "generating"} whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}>
            {status === "generating" ? <><LoaderCircle className="spin" size={19} /> Removing background & generating…</> : <><Sparkles size={18} /> Generate & download <ArrowRight size={18} /></>}
          </motion.button>

          <AnimatePresence>
            {message && (
              <motion.div className={`form-message ${status}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status">
                {status === "ready" ? <Check size={16} /> : status === "error" ? <ImageIcon size={16} /> : null}
                {message}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.form>

        <motion.aside
          className="preview-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
        >
          <div className="preview-heading">
            <div><span className="step-number">02</span><span><strong>Poster preview</strong><small>{status === "ready" ? "Your custom result" : "Template preview"}</small></span></div>
            {status === "ready" && <span className="ready-pill"><Check size={13} /> Ready</span>}
          </div>

          <div className="poster-stage">
            <div className="poster-glow" />
            <AnimatePresence mode="wait">
              <motion.div className="poster-frame" key={resultPreview ? "result" : "template"} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultPreview || TEMPLATE_1_URLS.template} alt={resultPreview ? "Generated poster" : "Poster template preview"} />
                {status === "generating" && <div className="generating-overlay"><span className="scan-line" /><LoaderCircle className="spin" size={28} /><strong>Creating your poster</strong><span>Removing the background and aligning your photo…</span></div>}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="preview-footer">
            <span><ImageIcon size={16} /> 1587 × 2245 px · JPG</span>
            {resultPreview ? (
              <button type="button" className="download-again" onClick={() => downloadResult(resultPreview)}><Download size={16} /> Download again</button>
            ) : (
              <span className="preview-hint"><RefreshCcw size={14} /> Updates after generation</span>
            )}
          </div>
        </motion.aside>
      </section>

      <footer><span>InsureBuddy Studio</span><span>Photos are processed locally in your browser.</span></footer>
    </main>
  );
}
