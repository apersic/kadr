import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Bubble, emptyBrief, gymbeamBrief, Phase, type BriefFields } from "./lib/types";
import { CopyMessageButton } from "./lib/components";
import { parseStudio } from "./lib/helpers/parse";
import { question, claimLabel, isOptional, nextAsk, fieldKey } from "./lib/helpers/chatbot";

const SKIP = /^(preskoči|preskoci|skip|nema|-)$/i;

export function App() {
  const [messages, setMessages] = useState<Bubble[]>([{ id: 1, role: "agent", text: question("brand") }]);
  const [phase, setPhase] = useState<Phase>("brand");
  const [fields, setFields] = useState<BriefFields>(emptyBrief);
  const [uploads, setUploads] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(2);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  function say(role: Bubble["role"], text: string, extra?: Omit<Bubble, "id" | "role" | "text">) {
    const id = nextId.current;
    nextId.current += 1;
    setMessages((current) => [...current, { id, role, text, ...extra }]);
  }

  async function run(brief: BriefFields, photos: string[]) {
    setBusy(true);
    setPhase("done");
    say(
      "agent",
      "Imam brief. Čitam stranicu i profil, pa šaljem predložak modelu za pet fotografija.",
    );
    try {
      const response = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(brief),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Nisam uspio složiti objave.";
        throw new Error(message);
      }
      const studio = parseStudio(payload);
      const frames = studio.frames.map((group, index) =>
        group
          .map((src, frame) => {
            const post = studio.analysis.posts[index];
            if (post?.id === 2) return photos[frame] || src;
            return photos[0] || src;
          })
          .filter((src) => src.length > 0),
      );
      const notes = studio.analysis.claims.map((claim) => `${claimLabel(claim.kind)}. ${claim.text}`);
      if (studio.imageNote) notes.unshift(studio.imageNote);
      say("agent", "Tri objave. Fotografija je od modela, ili tvoja ako si je priložio. Tekst ostaje u natpisu. Predlošci su odvojeni. Zalijepi jedan po jedan. Ništa nije otišlo na Instagram.", {
        posts: studio.analysis.posts.map((post, index) => ({
          id: post.id,
          format: post.format,
          goal: post.goal,
          caption: post.caption,
          why: post.why,
          images: frames[index] ?? [],
        })),
        notes,
        prompts: studio.prompts,
      });
    } catch (caught) {
      say("agent", caught instanceof Error ? caught.message : "Nisam uspio složiti objave.");
    } finally {
      setBusy(false);
    }
  }

  function accept(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (phase === "done") {
      setFields(emptyBrief);
      setUploads([]);
      setPhase("brand");
      say("user", trimmed);
      if (/^gymbeam$/i.test(trimmed)) {
        say("agent", "Uzimam GymBeam kao probu. Stranica je gymbeam.hr, profil je gymbeamhr, proizvodi su MoiMuv Protein Milkshake, Proteinski chips i Vitamin C 1000 mg.");
        void run(gymbeamBrief, []);
        return;
      }
      setFields((current) => ({ ...current, brand: trimmed }));
      setPhase("website");
      say("agent", question("website"));
      return;
    }
    say("user", trimmed);
    if (phase === "brand" && /^gymbeam$/i.test(trimmed)) {
      say("agent", "Uzimam GymBeam kao probu. Stranica je gymbeam.hr, profil je gymbeamhr, proizvodi su MoiMuv Protein Milkshake, Proteinski chips i Vitamin C 1000 mg.");
      void run(gymbeamBrief, uploads);
      return;
    }
    if (SKIP.test(trimmed) && isOptional(phase)) {
      const following = nextAsk(phase);
      if (following === "run") {
        void run(fields, uploads);
        return;
      }
      setPhase(following);
      say("agent", question(following));
      return;
    }
    const key = fieldKey(phase);
    if (key && trimmed.length < 2 && !isOptional(phase)) {
      say("agent", "Treba mi malo konkretniji odgovor.");
      return;
    }
    const nextFields = key ? { ...fields, [key]: trimmed } : fields;
    if (key) setFields(nextFields);
    const following = nextAsk(phase);
    if (following === "run") {
      void run(nextFields, uploads);
      return;
    }
    setPhase(following);
    say("agent", question(following));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft;
    setDraft("");
    accept(text);
  }

  return (
    <div className="chat">
      <header className="chat-top">
        <p className="mark">Kadr</p>
        <p>Agent za tri objave. Brief ide redom, slike crta model.</p>
      </header>
      <div className="thread">
        {messages.map((message) => (
          <article key={message.id} className={message.role === "agent" ? "bubble agent" : "bubble user"}>
            {message.role === "agent" ? <p className="who">Kadr</p> : null}
            <p>{message.text}</p>
            {message.posts?.map((post) => (
              <div key={post.id} className="post">
                <div className="frames">
                  {post.images.map((src, index) => (
                    <figure key={`${post.id}-${index}`}>
                      <img src={src} alt={`${post.format}, kadar ${index + 1}`} />
                      <a download={`objava-${post.id}-${index + 1}.png`} href={src}>
                        Preuzmi
                      </a>
                    </figure>
                  ))}
                </div>
                <dl className="post-facts">
                  <dt>Natpis</dt>
                  <dd>
                    <pre>{post.caption}</pre>
                  </dd>
                  <dt>Format</dt>
                  <dd>{post.format}</dd>
                  <dt>Cilj</dt>
                  <dd>{post.goal}</dd>
                  <dt>Obrazloženje</dt>
                  <dd>{post.why}</dd>
                </dl>
              </div>
            ))}
            {message.notes && message.notes.length > 0 ? (
              <details className="checks">
                <summary>Provjereno</summary>
                <ul className="notes">
                  {message.notes.map((note, index) => (
                    <li key={`${index}-${note.slice(0, 24)}`}>{note}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {message.prompts?.map((item, index) => (
              <div key={`${item.label}-${index}`} className="prompt">
                <details>
                  <summary>{item.label}</summary>
                  <pre>{item.text}</pre>
                </details>
                <CopyMessageButton text={item.text} />
                <a className="prompt-file" download={`prompt-${index + 1}.txt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(item.text)}`}>
                  prompt-{index + 1}.txt
                </a>
              </div>
            ))}
          </article>
        ))}
        {busy ? <p className="bubble agent waiting">Čitam stranicu i čekam fotografije…</p> : null}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={onSubmit}>
        {phase === "brand" || phase === "done" ? (
          <button type="button" className="chip" disabled={busy} onClick={() => accept("GymBeam")}>
            GymBeam
          </button>
        ) : null}
        {phase !== "done" && phase !== "brand" && isOptional(phase) ? (
          <button type="button" className="chip" disabled={busy} onClick={() => accept("preskoči")}>
            Preskoči
          </button>
        ) : null}
        {phase === "photos" ? (
          <label className="clip">
            Slike
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const list = event.target.files;
                if (!list || list.length === 0) return;
                void Promise.all(
                  [...list].map(
                    (file) =>
                      new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === "string") resolve(reader.result);
                          else reject(new Error("Slika se nije pročitala."));
                        };
                        reader.onerror = () => reject(new Error("Slika se nije pročitala."));
                        reader.readAsDataURL(file);
                      }),
                  ),
                )
                  .then((urls) => {
                    setUploads(urls);
                    say("user", urls.length === 1 ? "Prilažem sliku." : `Prilažem ${urls.length} slike.`);
                    void run(fields, urls);
                  })
                  .catch((caught: unknown) => {
                    say("agent", caught instanceof Error ? caught.message : "Slika se nije pročitala.");
                  });
              }}
            />
          </label>
        ) : null}
        <input
          value={draft}
          placeholder="Napiši odgovor"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="send" type="submit" disabled={busy || draft.trim().length === 0}>
          Pošalji
        </button>
      </form>
    </div>
  );
}
