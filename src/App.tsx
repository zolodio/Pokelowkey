import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Search, MapPin, Plus, Bookmark, MessageCircle, UserRound, Compass,
  Camera, X, Menu, LogOut, ShieldCheck, SlidersHorizontal, Heart,
  ArrowRight, Send, ImagePlus, Package, Sparkles, ChevronDown, CheckCircle2,
  AlertCircle, LoaderCircle, Layers3, MapPinned, Trash2
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";

type Listing = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  condition: string;
  category: string;
  city: string;
  images: string[];
  status: string;
  created_at: string;
  profiles?: { alias: string } | null;
};
type Profile = { id: string; alias: string; city: string | null; created_at: string };
type Message = {
  id: string; listing_id: string; sender_id: string; recipient_id: string;
  body: string; created_at: string; listing?: { title: string } | null;
};

const categories = ["All", "Singles", "Sealed", "Collections", "Graded"];
const demoListings: Listing[] = [
  {
    id: "demo-1", seller_id: "demo-user-1", title: "Charizard ex — 199/165",
    description: "Special Illustration Rare from Scarlet & Violet 151. Stored sleeved and in a top loader.",
    price: 185, condition: "Near Mint", category: "Singles", city: "Petoskey",
    images: ["https://images.pokemontcg.io/sv3pt5/199.png"], status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    profiles: { alias: "NorthShoreCollector" }
  },
  {
    id: "demo-2", seller_id: "demo-user-2", title: "Pokémon 151 Elite Trainer Box",
    description: "Factory sealed. Looking to sell locally.",
    price: 95, condition: "Sealed", category: "Sealed", city: "Harbor Springs",
    images: ["https://images.pokemontcg.io/sv3pt5/205.png"], status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    profiles: { alias: "LakeEffectCards" }
  },
  {
    id: "demo-3", seller_id: "demo-user-3", title: "Vintage binder — Base, Jungle & Fossil",
    description: "A binder of vintage cards. Message for more photos and details.",
    price: 275, condition: "Mixed", category: "Collections", city: "Charlevoix",
    images: ["https://images.pokemontcg.io/base1/4.png"], status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    profiles: { alias: "UpNorthTCG" }
  },
  {
    id: "demo-4", seller_id: "demo-user-4", title: "Pikachu VMAX Rainbow — 188/185",
    description: "Vivid Voltage rainbow rare. Happy to meet in a public place.",
    price: 72, condition: "Lightly Played", category: "Singles", city: "Petoskey",
    images: ["https://images.pokemontcg.io/swsh4/188.png"], status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    profiles: { alias: "PikaFinds" }
  }
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function timeAgo(date: string) {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
function initials(alias: string) {
  return alias.slice(0, 2).toUpperCase();
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>(demoListings);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Explore");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [showCreate, setShowCreate] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThread, setActiveThread] = useState<{ listing: Listing; otherId: string; otherAlias: string } | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) {
      setProfile(null);
      return;
    }
    void loadProfile(session.user);
  }, [session?.user?.id]);

  useEffect(() => {
    void loadListings();
  }, [session?.user?.id]);

  useEffect(() => {
    if (tab === "Messages" && session?.user) void loadMessages();
  }, [tab, session?.user?.id]);

  async function loadProfile(user: User) {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) setProfile(data as Profile);
  }

  async function loadListings() {
    if (!supabase) { setListings(demoListings); setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("listings")
      .select("*, profiles(alias)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) setError(queryError.message);
    else setListings((data as Listing[]) || []);
    setLoading(false);
  }

  async function loadMessages() {
    if (!supabase || !session?.user) return;
    const { data, error: queryError } = await supabase
      .from("messages")
      .select("*, listings(title)")
      .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) setError(queryError.message);
    else setMessages((data as Message[]) || []);
  }

  const visibleListings = useMemo(() => {
    let rows = listings.filter((item) =>
      (category === "All" || item.category === category) &&
      `${item.title} ${item.description || ""} ${item.city}`.toLowerCase().includes(search.toLowerCase())
    );
    if (tab === "My Listings") rows = rows.filter((item) => item.seller_id === session?.user.id);
    if (tab === "Saved") rows = rows.filter((item) => saved.includes(item.id));
    if (sort === "price-low") rows = [...rows].sort((a, b) => a.price - b.price);
    if (sort === "price-high") rows = [...rows].sort((a, b) => b.price - a.price);
    return rows;
  }, [listings, category, search, tab, session?.user.id, saved, sort]);

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setTab("Explore");
    setNotice("Signed out.");
  }

  function requireAuth(action: () => void) {
    if (!session) { setShowAuth(true); return; }
    action();
  }

  async function toggleSaved(id: string) {
    if (!session) { setShowAuth(true); return; }
    if (!supabase) return;
    const exists = saved.includes(id);
    const next = exists ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    if (exists) await supabase.from("saved_items").delete().eq("user_id", session.user.id).eq("listing_id", id);
    else {
      const { error: saveError } = await supabase.from("saved_items").insert({ user_id: session.user.id, listing_id: id });
      if (saveError) { setSaved(saved); setError(saveError.message); }
    }
  }

  async function sendMessage(listing: Listing, body: string) {
    if (!supabase || !session?.user) return;
    if (listing.seller_id === session.user.id) { setError("That's your own listing."); return; }
    const { error: sendError } = await supabase.from("messages").insert({
      listing_id: listing.id, sender_id: session.user.id, recipient_id: listing.seller_id, body
    });
    if (sendError) setError(sendError.message);
    else { setNotice("Message sent."); setSelected(null); await loadMessages(); setTab("Messages"); }
  }

  const navItems = [
    { name: "Explore", icon: Compass },
    { name: "Saved", icon: Bookmark },
    { name: "My Listings", icon: Package },
    { name: "Messages", icon: MessageCircle },
    { name: "Profile", icon: UserRound }
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setTab("Explore"); }}>
          <span className="brand-mark"><Layers3 size={21} /></span>
          <span className="brand-name">PETOSKÉMON<span className="brand-dot">.</span><small>LOCAL COLLECTOR MARKETPLACE</small></span>
        </a>
        <div className="top-location"><MapPin size={15} /> Petoskey area <span className="location-dot" /></div>
        <div className="top-actions">
          {session ? (
            <button className="avatar-button" onClick={() => setTab("Profile")} title="Your profile">
              {initials(profile?.alias || "Me")}
            </button>
          ) : (
            <button className="button button-quiet" onClick={() => setShowAuth(true)}>Sign in</button>
          )}
          <button className="button button-gold top-sell" onClick={() => requireAuth(() => setShowCreate(true))}><Plus size={16} /> Sell something</button>
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu"><Menu /></button>
        </div>
      </header>

      {mobileMenu && <div className="mobile-nav">{navItems.map((item) => <button key={item.name} onClick={() => { setTab(item.name); setMobileMenu(false); }}><item.icon size={17}/>{item.name}</button>)}</div>}

      <main>
        {tab === "Explore" || tab === "Saved" || tab === "My Listings" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-line" /> NORTHERN MICHIGAN'S COLLECTOR MARKETPLACE</div>
                <h1>Your next grail<br/><em>is closer than you think.</em></h1>
                <p>Buy, sell, and trade Pokémon cards with collectors nearby. No ads. No noise. Just the hobby.</p>
                <div className="hero-actions">
                  <button className="button button-gold" onClick={() => document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" })}>Explore listings <ArrowRight size={16}/></button>
                  <button className="button button-outline" onClick={() => requireAuth(() => setShowCreate(true))}><Camera size={16}/> List a card</button>
                </div>
              </div>
              <div className="hero-art">
                <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
                <div className="hero-card card-back"><div className="card-back-inner"><span>POKÉMON</span><div className="card-orb">✦</div><small>COLLECT LOCAL</small></div></div>
                <div className="hero-card card-front"><img src="https://images.pokemontcg.io/sv3pt5/199.png" alt="Illustrative Pokémon card" /><span className="card-caption">THE HUNT STARTS HERE</span></div>
                <div className="floating-tag"><Sparkles size={14}/> Good finds, close by</div>
              </div>
            </section>

            <section className="market-section" id="marketplace">
              <div className="section-heading">
                <div><div className="eyebrow dark-eyebrow">THE LOCAL MARKET</div><h2>{tab === "Saved" ? "Your saved finds" : tab === "My Listings" ? "Your listings" : "Find your next favorite."}</h2><p>Real collectors. Real cards. Close to home.</p></div>
                <div className="market-count"><span className="count-dot"/>{listings.length} {isSupabaseConfigured ? "live listings" : "sample listings"}</div>
              </div>
              <div className="search-panel">
                <div className="search-field"><Search size={19}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Pokémon, sets, card numbers..." /></div>
                <div className="select-wrap"><SlidersHorizontal size={16}/><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select><ChevronDown size={14}/></div>
                <div className="select-wrap sort-select"><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Recently listed</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown size={14}/></div>
              </div>

              {!isSupabaseConfigured && <div className="demo-notice"><AlertCircle size={16}/> Preview mode: connect your Supabase project to publish real listings and enable accounts.</div>}
              {error && <div className="inline-error"><AlertCircle size={16}/>{error}<button onClick={() => setError("")}><X size={14}/></button></div>}
              {notice && <div className="inline-success"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice("")}><X size={14}/></button></div>}

              {loading ? <div className="loading-state"><LoaderCircle className="spin"/> Loading the local market…</div> :
                visibleListings.length ? <div className="listing-grid">{visibleListings.map((item) => <ListingCard key={item.id} item={item} saved={saved.includes(item.id)} onSave={() => toggleSaved(item.id)} onOpen={() => setSelected(item)} /></div> :
                <div className="empty-state"><Package size={32}/><h3>Nothing here just yet.</h3><p>Try a different search, or be the first to list something.</p><button className="button button-gold" onClick={() => requireAuth(() => setShowCreate(true))}>Create a listing</button></div>}
            </section>
          </>
        ) : tab === "Messages" ? (
          <section className="page-section">
            <div className="eyebrow dark-eyebrow">PRIVATE COMMUNICATION</div><h2>Your messages</h2><p className="page-intro">Talk directly with local collectors. Keep personal contact details private.</p>
            {!session ? <SignInPrompt onClick={() => setShowAuth(true)} /> : messages.length === 0 ? <div className="empty-state"><MessageCircle size={32}/><h3>No conversations yet.</h3><p>Message a seller from any listing to get started.</p></div> :
              <div className="message-list">{messages.map((m) => <button className="message-row" key={m.id} onClick={() => {
                const listing = listings.find((l) => l.id === m.listing_id);
                if (listing) setActiveThread({ listing, otherId: m.sender_id === session.user.id ? m.recipient_id : m.sender_id, otherAlias: "Collector" });
              }}><span className="message-avatar"><MessageCircle size={18}/></span><span className="message-row-text"><strong>{m.listing?.title || "Listing conversation"}</strong><small>{m.body}</small></span><time>{timeAgo(m.created_at)}</time></button>)}</div>}
            {activeThread && <MessageComposer listing={activeThread.listing} onClose={() => setActiveThread(null)} onSend={async (body) => {
              if (!supabase || !session) return;
              const { error: e } = await supabase.from("messages").insert({ listing_id: activeThread.listing.id, sender_id: session.user.id, recipient_id: activeThread.otherId, body });
              if (e) setError(e.message); else await loadMessages();
            }}/>}
          </section>
        ) : (
          <section className="page-section">
            <div className="eyebrow dark-eyebrow">YOUR COLLECTOR IDENTITY</div><h2>Your collector profile</h2><p className="page-intro">A public alias. Your personal information stays private.</p>
            {!session ? <SignInPrompt onClick={() => setShowAuth(true)} /> : <ProfilePanel profile={profile} user={session.user} onSignOut={signOut} onUpdate={async (alias, city) => {
              if (!supabase || !session) return;
              const { data, error: e } = await supabase.from("profiles").update({ alias, city }).eq("id", session.user.id).select().single();
              if (e) setError(e.message); else { setProfile(data as Profile); setNotice("Profile updated."); }
            }}/>}
          </section>
        )}
      </main>

      <footer className="footer"><div className="footer-brand">PETOSKÉMON<span>.</span></div><p>A local marketplace built for collectors.</p><div className="footer-meta"><span>Independent community marketplace</span><span>Privacy first · No advertising</span></div><small>Not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK, or The Pokémon Company. Pokémon and related names are trademarks of their respective owners.</small></footer>

      {showCreate && <CreateListingModal onClose={() => setShowCreate(false)} user={session?.user || null} onCreated={(listing) => { setListings((old) => [listing, ...old]); setShowCreate(false); setTab("My Listings"); setNotice("Your listing is live."); }} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onNotice={setNotice} />}
      {selected && <ListingModal item={selected} user={session?.user || null} saved={saved.includes(selected.id)} onSave={() => toggleSaved(selected.id)} onClose={() => setSelected(null)} onSignIn={() => { setSelected(null); setShowAuth(true); }} onSend={sendMessage}/>}
    </div>
  );
}

function ListingCard({ item, saved, onSave, onOpen }: { item: Listing; saved: boolean; onSave: () => void; onOpen: () => void }) {
  return <article className="listing-card">
    <button className="listing-image-button" onClick={onOpen}>
      <div className="listing-image">{item.images?.[0] ? <img src={item.images[0]} alt={item.title} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="image-placeholder"><Layers3 size={42}/><span>LOCAL FIND</span></div>}</div>
      <span className="listing-category">{item.category}</span>
    </button>
    <button className={`save-button ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={saved ? "Remove saved listing" : "Save listing"}><Heart size={17} fill={saved ? "currentColor" : "none"}/></button>
    <div className="listing-info">
      <div className="listing-meta"><span>{item.condition}</span><span>{timeAgo(item.created_at)}</span></div>
      <button className="listing-title" onClick={onOpen}>{item.title}</button>
      <div className="listing-location"><MapPin size={13}/>{item.city || "Northern Michigan"} area</div>
      <div className="listing-bottom"><strong>{money(item.price)}</strong><span className="seller-alias">{item.profiles?.alias || "Local collector"}</span></div>
    </div>
  </article>;
}

function SignInPrompt({ onClick }: { onClick: () => void }) {
  return <div className="signin-prompt"><ShieldCheck size={30}/><h3>Sign in to continue</h3><p>Create a collector alias to save listings, contact sellers, and manage your cards.</p><button className="button button-gold" onClick={onClick}>Sign in or create account</button></div>;
}

function AuthModal({ onClose, onNotice }: { onClose: () => void; onNotice: (s: string) => void }) {
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setLocalError("");
    const { error: e2 } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, data: { alias: alias.trim() } }
    });
    setBusy(false);
    if (e2) setLocalError(e2.message);
    else { setSent(true); onNotice("Check your email for your sign-in link."); }
  }
  return <Modal onClose={onClose}><div className="modal-heading"><div className="eyebrow dark-eyebrow">WELCOME TO THE COMMUNITY</div><h2>{sent ? "Check your inbox." : "Your alias. Your hobby."}</h2><p>{sent ? "We sent you a secure sign-in link. Open it on this device to continue." : "No public real names. Sign in with an email link and choose your collector alias."}</p></div>
    {!sent && <form onSubmit={submit} className="form-stack"><label>Collector alias<input required minLength={3} maxLength={24} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. NorthShoreCollector"/></label><label>Email address<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"/></label>{localError && <p className="form-error">{localError}</p>}<button className="button button-gold button-full" disabled={busy}>{busy ? "Sending link…" : "Email me a sign-in link"} <ArrowRight size={16}/></button></form>}
    <div className="privacy-note"><ShieldCheck size={15}/> Your email is private and never appears on your public profile.</div>
  </Modal>;
}

function CreateListingModal({ onClose, user, onCreated }: { onClose: () => void; user: User | null; onCreated: (l: Listing) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("Near Mint");
  const [category, setCategory] = useState("Singles");
  const [city, setCity] = useState("Petoskey");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setLocalError("");
    try {
      let imageUrl = "";
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("listing-images").upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
      const { data, error: insertError } = await supabase.from("listings").insert({
        seller_id: user.id, title: title.trim(), description: description.trim(),
        price: Number(price), condition, category, city: city.trim(), images: imageUrl ? [imageUrl] : [], status: "active"
      }).select("*, profiles(alias)").single();
      if (insertError) throw insertError;
      onCreated(data as Listing);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Unable to create listing.");
    } finally { setBusy(false); }
  }
  return <Modal onClose={onClose} wide><div className="modal-heading"><div className="eyebrow dark-eyebrow">PUT IT OUT THERE</div><h2>Create a listing</h2><p>Clear photos and honest condition details help collectors buy confidently.</p></div>
    <form onSubmit={submit} className="form-stack">
      <label>Listing title<input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Charizard ex 199/165 — Pokémon 151"/></label>
      <div className="form-row"><label>Price (USD)<input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00"/></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Singles</option><option>Sealed</option><option>Collections</option><option>Graded</option></select></label></div>
      <div className="form-row"><label>Condition<select value={condition} onChange={(e) => setCondition(e.target.value)}>{["Near Mint","Lightly Played","Moderately Played","Heavily Played","Damaged","Sealed","Mixed"].map((v) => <option key={v}>{v}</option>)}</select></label><label>City / area<input required maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Petoskey"/></label></div>
      <label>Description<textarea rows={4} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition details, language, set, collector number, trade interests…"/></label>
      <label className="upload-box"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); setPreview(f ? URL.createObjectURL(f) : ""); }} /><span className="upload-icon"><ImagePlus size={22}/></span><strong>{file ? file.name : "Add a listing photo"}</strong><small>JPG, PNG, or WebP · Max 8 MB</small>{preview && <img className="upload-preview" src={preview} alt="Listing preview"/>}</label>
      {localError && <p className="form-error">{localError}</p>}
      <button className="button button-gold button-full" disabled={busy}>{busy ? "Publishing…" : "Publish listing"} <ArrowRight size={16}/></button>
    </form>
  </Modal>;
}

function ListingModal({ item, user, saved, onSave, onClose, onSignIn, onSend }: { item: Listing; user: User | null; saved: boolean; onSave: () => void; onClose: () => void; onSignIn: () => void; onSend: (l: Listing, body: string) => void }) {
  const [body, setBody] = useState("");
  return <Modal onClose={onClose} wide><div className="detail-layout">
    <div className="detail-image">{item.images?.[0] ? <img src={item.images[0]} alt={item.title}/> : <div className="image-placeholder"><Layers3 size={48}/></div>}</div>
    <div className="detail-content"><div className="eyebrow dark-eyebrow">{item.category} · {item.condition}</div><h2>{item.title}</h2><div className="detail-price">{money(item.price)}</div><div className="detail-location"><MapPin size={15}/>{item.city} area</div><p>{item.description || "No additional description provided."}</p><div className="seller-card"><span className="seller-avatar">{initials(item.profiles?.alias || "LC")}</span><span><strong>{item.profiles?.alias || "Local collector"}</strong><small>Community seller</small></span><ShieldCheck size={18}/></div>
      <button className="button button-outline button-full" onClick={onSave}><Heart size={16} fill={saved ? "currentColor" : "none"}/>{saved ? "Saved" : "Save listing"}</button>
      {user && user.id !== item.seller_id ? <form className="contact-form" onSubmit={(e) => { e.preventDefault(); if (body.trim()) onSend(item, body.trim()); }}><label>Message the seller<textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi! Is this still available?"/></label><button className="button button-gold button-full"><Send size={15}/> Send message</button></form> : !user ? <button className="button button-gold button-full" onClick={onSignIn}>Sign in to contact seller</button> : <p className="own-listing-note">This is your listing.</p>}
    </div>
  </div></Modal>;
}

function MessageComposer({ listing, onClose, onSend }: { listing: Listing; onClose: () => void; onSend: (s: string) => void }) {
  const [body, setBody] = useState("");
  return <div className="thread-panel"><div className="thread-head"><strong>{listing.title}</strong><button className="icon-button" onClick={onClose}><X size={17}/></button></div><form onSubmit={(e) => { e.preventDefault(); if (body.trim()) { onSend(body.trim()); setBody(""); } }}><input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…"/><button className="button button-gold"><Send size={15}/></button></form></div>;
}

function ProfilePanel({ profile, user, onSignOut, onUpdate }: { profile: Profile | null; user: User; onSignOut: () => void; onUpdate: (a: string, c: string) => void }) {
  const [alias, setAlias] = useState(profile?.alias || "");
  const [city, setCity] = useState(profile?.city || "Petoskey");
  useEffect(() => { setAlias(profile?.alias || ""); setCity(profile?.city || "Petoskey"); }, [profile]);
  return <div className="profile-panel"><div className="profile-identity"><span className="profile-avatar">{initials(profile?.alias || "Me")}</span><div><h3>{profile?.alias || "Your collector alias"}</h3><p><MapPin size={13}/>{profile?.city || "Northern Michigan"} area</p></div></div><form className="form-stack" onSubmit={(e) => { e.preventDefault(); onUpdate(alias.trim(), city.trim()); }}><label>Public collector alias<input required minLength={3} maxLength={24} value={alias} onChange={(e) => setAlias(e.target.value)}/></label><label>General location<input required maxLength={60} value={city} onChange={(e) => setCity(e.target.value)}/></label><label>Private sign-in email<input disabled value={user.email || ""}/><small className="field-hint">Only you can see this email.</small></label><button className="button button-gold">Save profile</button></form><button className="button button-quiet signout-button" onClick={onSignOut}><LogOut size={16}/> Sign out</button></div>;
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={`modal ${wide ? "modal-wide" : ""}`}><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button>{children}</div></div>;
}
