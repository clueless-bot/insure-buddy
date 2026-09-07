"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Download,
  ImageIcon,
  Layers3,
  LoaderCircle,
  Mail,
  Package,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  GeneratedPoster,
  POSTER_COORDINATES,
  generatePosters,
} from "@/poster_generator";

type Status = "idle" | "generating" | "ready" | "error";

type TemplateItem = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
};

type ResultItem = GeneratedPoster & {
  id: string;
  url: string;
};

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

function fileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [profile, setProfile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [templateDragging, setTemplateDragging] = useState(false);
  const [profileDragging, setProfileDragging] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());

  function createTrackedUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    objectUrls.current.add(url);
    return url;
  }

  function releaseUrl(url: string) {
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  }

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const activeTemplate = templates.find((template) => template.id === activeTemplateId) || templates[0];
  const activeResult = activeResultId
    ? results.find((result) => result.id === activeResultId) || null
    : null;
  const expectedOutputs = templates.length;
  const preview = activeResult || activeTemplate;

  const minimumTemplateSize = useMemo(() => ({
    width: Math.ceil(POSTER_COORDINATES.image.x + POSTER_COORDINATES.image.width),
    height: Math.ceil(POSTER_COORDINATES.email.y + POSTER_COORDINATES.email.height),
  }), []);

  async function selectTemplates(files: File[]) {
    const valid = files.filter((file) =>
      ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE,
    );
    if (!valid.length) {
      setStatus("error");
      setMessage("Choose PNG, JPG, or WebP templates smaller than 25 MB.");
      return;
    }

    try {
      const additions = await Promise.all(valid.map(async (file) => {
        const bitmap = await createImageBitmap(file);
        const item: TemplateItem = {
          id: fileId(file),
          file,
          url: createTrackedUrl(file),
          width: bitmap.width,
          height: bitmap.height,
        };
        bitmap.close();
        return item;
      }));
      clearResults();
      setTemplates((current) => [...current, ...additions]);
      setActiveTemplateId((current) => current || additions[0].id);
      setActiveResultId(null);
      setStatus("idle");
      setMessage(valid.length < files.length ? "Some unsupported or oversized templates were skipped." : "");
    } catch {
      setStatus("error");
      setMessage("One or more template images could not be read.");
    }
  }

  function removeTemplate(id: string) {
    clearResults();
    const item = templates.find((template) => template.id === id);
    if (item) releaseUrl(item.url);
    const remaining = templates.filter((template) => template.id !== id);
    setTemplates(remaining);
    if (activeTemplateId === id) setActiveTemplateId(remaining[0]?.id || null);
    setActiveResultId(null);
  }

  function selectProfile(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      setStatus("error");
      setMessage("Choose a PNG, JPG, or WebP portrait smaller than 25 MB.");
      return;
    }
    if (profilePreview) releaseUrl(profilePreview);
    clearResults();
    setProfile(file);
    setProfilePreview(createTrackedUrl(file));
    setStatus("idle");
    setMessage("");
  }

  function clearResults() {
    if (!results.length) return;
    results.forEach((result) => releaseUrl(result.url));
    setResults([]);
    setActiveResultId(null);
    setStatus("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templates.length) {
      setStatus("error");
      setMessage("Upload at least one poster template.");
      templateInputRef.current?.focus();
      return;
    }
    if (!profile) {
      setStatus("error");
      setMessage("Upload a profile photo.");
      profileInputRef.current?.focus();
      return;
    }

    const contacts = [{ email: email.trim(), phoneNumber: phoneNumber.trim() }];
    if (!contacts[0].email || !contacts[0].phoneNumber) {
      setStatus("error");
      setMessage("Enter a valid email and phone number.");
      return;
    }
    const invalidIndex = contacts.findIndex((contact) =>
      !/^\S+@\S+\.\S+$/.test(contact.email) || !/^[+0-9 ()-]{7,20}$/.test(contact.phoneNumber),
    );
    if (invalidIndex >= 0) {
      setStatus("error");
      setMessage("Enter a valid email and phone number.");
      return;
    }

    clearResults();
    setStatus("generating");
    setMessage("Preparing the background-removal model…");

    try {
      const generated = await generatePosters({
        templates: templates.map((template) => template.file),
        profileImage: profile,
        contacts,
        onProgress: (progress) => {
          if (progress.phase === "model") {
            setMessage(`Loading the local AI model… ${progress.percent}%`);
          } else {
            setMessage(`Rendering poster ${progress.current} of ${progress.total}…`);
          }
        },
      });
      const nextResults = generated.map((result, index) => ({
        ...result,
        id: `${result.filename}-${index}-${crypto.randomUUID()}`,
        url: createTrackedUrl(result.blob),
      }));
      setResults(nextResults);
      setActiveResultId(nextResults[0]?.id || null);
      setStatus("ready");
      setMessage(`${nextResults.length} poster${nextResults.length === 1 ? " is" : "s are"} ready to download.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Poster generation failed.");
    }
  }

  async function downloadAll() {
    if (!results.length) return;
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].filename);
      return;
    }
    setDownloadingZip(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      results.forEach((result) => zip.file(result.filename, result.blob));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      downloadBlob(blob, "poster-studio-batch.zip");
    } finally {
      setDownloadingZip(false);
    }
  }

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Poster Studio home">
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.4} /></span>
          <span>Poster <strong>Studio</strong></span>
        </a>
        <span className="header-note"><span className="status-dot" /> Private, in-browser generation</span>
      </header>

      <section className="hero" id="top">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="eyebrow"><Layers3 size={15} /> Dynamic batch studio</span>
          <h1>One setup. <span>Every poster ready.</span></h1>
          <p>Upload any number of templates, add a contact manually, and create the full batch privately in your browser.</p>
          <div className="trust-row">
            <span><Check size={15} /> Unlimited templates</span>
            <span><Check size={15} /> Manual contact entry</span>
            <span><Check size={15} /> No photo uploads</span>
          </div>
        </motion.div>
      </section>

      <section className="studio-shell">
        <motion.form className="form-card" onSubmit={handleSubmit} initial={false} animate={{ opacity: 1, x: 0 }}>
          <div className="form-section">
            <div className="section-heading">
              <span className="step-number">01</span>
              <div><h2>Upload templates</h2><p>Add as many PNG, JPG, or WebP designs as you need.</p></div>
            </div>
            <div
              className={`upload-zone compact ${templateDragging ? "is-dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setTemplateDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setTemplateDragging(false)}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setTemplateDragging(false);
                void selectTemplates(Array.from(event.dataTransfer.files));
              }}
              onClick={() => templateInputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") templateInputRef.current?.click(); }}
              role="button"
              tabIndex={0}
            >
              <input ref={templateInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void selectTemplates(Array.from(event.target.files || []))} />
              <span className="upload-icon"><Plus size={22} /></span>
              <div className="upload-copy"><strong>Add poster templates</strong><span>Drop multiple files or click to browse · up to 25 MB each</span></div>
            </div>

            {templates.length > 0 && (
              <div className="template-list">
                {templates.map((template) => (
                  <button key={template.id} type="button" className={`template-chip ${activeTemplate?.id === template.id && !activeResult ? "active" : ""}`} onClick={() => { setActiveTemplateId(template.id); setActiveResultId(null); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={template.url} alt="" style={{ objectFit: "cover" }} />
                    <span><strong>{template.file.name}</strong><small>{template.width} × {template.height}px</small></span>
                    <span className="remove-file" role="button" aria-label={`Remove ${template.file.name}`} onClick={(event) => { event.stopPropagation(); removeTemplate(template.id); }}><Trash2 size={14} /></span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="section-heading">
              <span className="step-number">02</span>
              <div><h2>Add profile photo</h2><p>The background is removed once and reused across the batch.</p></div>
            </div>
            <div
              className={`upload-zone compact ${profileDragging ? "is-dragging" : ""} ${profile ? "has-file" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setProfileDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setProfileDragging(false)}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setProfileDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) selectProfile(file);
              }}
              onClick={() => profileInputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") profileInputRef.current?.click(); }}
              role="button"
              tabIndex={0}
            >
              <input ref={profileInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) selectProfile(file); }} />
              {profilePreview ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="portrait-thumb" src={profilePreview} alt="Selected profile" />
                <div className="upload-copy"><strong>{profile?.name}</strong><span>Click or drop to replace</span></div>
                <span className="file-check"><Check size={16} /></span>
              </> : <>
                <span className="upload-icon"><UserRound size={22} /></span>
                <div className="upload-copy"><strong>Add a clear portrait</strong><span>Front-facing photos produce the cleanest result</span></div>
              </>}
            </div>
          </div>

          <div className="form-section">
            <div className="section-heading contact-heading">
              <span className="step-number">03</span>
              <div><h2>Add contact details</h2><p>Enter the contact details for the poster.</p></div>
            </div>

            <motion.div className="contact-panel" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <label className="field-label" htmlFor="email">Email address</label>
              <div className="input-shell"><Mail size={17} /><input id="email" type="email" value={email} onChange={(event) => { clearResults(); setEmail(event.target.value); }} placeholder="you@example.com" maxLength={120} /></div>
              <label className="field-label" htmlFor="phoneNumber">Phone number</label>
              <div className="input-shell"><Phone size={17} /><input id="phoneNumber" type="tel" value={phoneNumber} onChange={(event) => { clearResults(); setPhoneNumber(event.target.value); }} placeholder="e.g. +91 98255 71289" maxLength={20} /></div>
            </motion.div>
          </div>

          <div className="batch-summary">
            <span><Layers3 size={16} /> {templates.length} template{templates.length === 1 ? "" : "s"}</span>
            <span>×</span>
            <span><UserRound size={16} /> 1 contact</span>
            <strong>{expectedOutputs} output{expectedOutputs === 1 ? "" : "s"}</strong>
          </div>

          <motion.button className="generate-button" type="submit" disabled={status === "generating"} whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}>
            {status === "generating" ? <><LoaderCircle className="spin" size={19} /> Generating batch…</> : <><Sparkles size={18} /> Generate {expectedOutputs || ""} poster{expectedOutputs === 1 ? "" : "s"} <ArrowRight size={18} /></>}
          </motion.button>

          <AnimatePresence>
            {message && <motion.div className={`form-message ${status}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} role="status">
              {status === "ready" ? <Check size={16} /> : status === "error" ? <ImageIcon size={16} /> : <LoaderCircle className="spin" size={16} />}
              {message}
            </motion.div>}
          </AnimatePresence>
        </motion.form>

        <motion.aside className="preview-card" initial={false} animate={{ opacity: 1, x: 0 }}>
          <div className="preview-heading">
            <div><span className="step-number">04</span><span><strong>{activeResult ? "Generated result" : "Template preview"}</strong><small>{preview ? `${preview.width} × ${preview.height}px` : "Upload a template to begin"}</small></span></div>
            {results.length > 0 && <button className="download-all" type="button" onClick={() => void downloadAll()} disabled={downloadingZip}>{downloadingZip ? <LoaderCircle className="spin" size={15} /> : results.length > 1 ? <Package size={15} /> : <Download size={15} />} {results.length > 1 ? "Download ZIP" : "Download"}</button>}
          </div>

          <div className="poster-stage">
            <div className="poster-glow" />
            {preview ? (
              <div className="poster-frame dynamic" style={{ aspectRatio: `${preview.width} / ${preview.height}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={activeResult ? "Generated poster" : "Uploaded template preview"} style={{ objectFit: "cover" }} />
                {!activeResult && activeTemplate && <div className="coordinate-layer" aria-hidden="true">
                  {(["image", "email", "phone"] as const).map((key) => {
                    const box = POSTER_COORDINATES[key];
                    return <span key={key} className={`coordinate-box ${key}`} style={{ left: `${box.x / activeTemplate.width * 100}%`, top: `${box.y / activeTemplate.height * 100}%`, width: `${box.width / activeTemplate.width * 100}%`, height: `${box.height / activeTemplate.height * 100}%` }}>{key}</span>;
                  })}
                </div>}
                {status === "generating" && <div className="generating-overlay"><LoaderCircle className="spin" size={28} /><strong>Creating your posters</strong><span>{message}</span></div>}
              </div>
            ) : (
              <button type="button" className="empty-preview" onClick={() => templateInputRef.current?.click()}>
                <span><ImageIcon size={28} /></span><strong>No template yet</strong><small>Upload one or more designs to see them here.</small>
              </button>
            )}
          </div>

          <div className="preview-footer">
            <span><ImageIcon size={16} /> Coordinates use exact source pixels</span>
            {activeTemplate && (activeTemplate.width < minimumTemplateSize.width || activeTemplate.height < minimumTemplateSize.height) && <span className="size-warning">Template is smaller than {minimumTemplateSize.width} × {minimumTemplateSize.height}px</span>}
          </div>

          {results.length > 0 && <div className="result-gallery">
            <div className="result-gallery-heading"><strong>Generated posters</strong><span>{results.length} files</span></div>
            <div className="result-grid">
              {results.map((result) => <button key={result.id} type="button" className={activeResult?.id === result.id ? "active" : ""} onClick={() => setActiveResultId(result.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.url} alt={`Result for ${result.email}`} style={{ objectFit: "cover" }} />
                <span><strong>{result.email}</strong><small>{result.templateName}</small></span>
                <span className="single-download" role="button" aria-label={`Download ${result.filename}`} onClick={(event) => { event.stopPropagation(); downloadBlob(result.blob, result.filename); }}><Download size={13} /></span>
              </button>)}
            </div>
          </div>}
        </motion.aside>
      </section>

      <footer><span>Poster Studio</span><span>Templates, portraits, CSV data, and generated files stay in your browser.</span></footer>
    </main>
  );
}
