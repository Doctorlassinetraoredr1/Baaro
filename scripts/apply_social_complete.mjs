#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const feedPath = path.join(process.cwd(), "src/features/feed/FeedTab.jsx");
const backupPath = feedPath + ".social-complete.bak";
if (!fs.existsSync(feedPath)) throw new Error(`Fichier introuvable: ${feedPath}`);
if (fs.existsSync(backupPath)) throw new Error(`Sauvegarde déjà présente: ${backupPath}`);

let src = fs.readFileSync(feedPath, "utf8");
fs.copyFileSync(feedPath, backupPath);

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`Bloc introuvable: ${label}`);
  src = src.replace(from, to);
}

replaceOnce(
  'import { TranslateButton } from "../../components/TranslateButton.jsx";',
  'import { TranslateButton } from "../../components/TranslateButton.jsx";\nimport { PollCard, SocialPostEnhancements, SocialSuggestions } from "./SocialEnhancements.jsx";',
  "imports"
);

replaceOnce(
  '  const [showPoll, setShowPoll] = useState(false);',
  '  const [showPoll, setShowPoll] = useState(false);\n  const [pollQuestion, setPollQuestion] = useState("");\n  const [pollOptions, setPollOptions] = useState(["", ""]);',
  "poll state"
);

replaceOnce(
  '    if ((!newText.trim() && !mediaFile) || submitting) return;',
  '    const hasPollDraft = showPoll && pollQuestion.trim() && pollOptions.filter((x) => x.trim()).length >= 2;\n    if ((!newText.trim() && !mediaFile && !hasPollDraft) || submitting) return;',
  "publish guard"
);

replaceOnce(
  '      if (error) throw error;\n\n      setNewText("");',
  String.raw`      if (error) throw error;

      if (showPoll) {
        const cleanOptions = pollOptions.map((x) => x.trim()).filter(Boolean).slice(0, 6);
        if (pollQuestion.trim() && cleanOptions.length >= 2) {
          const { data: poll, error: pollError } = await supabase
            .from("polls")
            .insert({ post_id: createdPost.id, question: pollQuestion.trim() })
            .select("id")
            .single();
          if (pollError) throw pollError;

          const { error: optionsError } = await supabase.from("poll_options").insert(
            cleanOptions.map((option_text, position) => ({ poll_id: poll.id, option_text, position }))
          );
          if (optionsError) throw optionsError;
        }
      }

      setNewText("");`,
  "poll creation"
);

replaceOnce(
  '      setMood("");\n      setShowPoll(false);',
  '      setMood("");\n      setShowPoll(false);\n      setPollQuestion("");\n      setPollOptions(["", ""]);',
  "poll reset"
);

replaceOnce(
  String.raw`        {showPoll && (
          <div
            className="mb-3 p-3 rounded-xl border text-xs"
            style={{
              background: COLORS.surface,
              borderColor: COLORS.borderTeal,
              color: COLORS.muted,
            }}
          >
            Sondages bientôt disponibles
          </div>
        )}`,
  String.raw`        {showPoll && (
          <div className="mb-3 p-3 rounded-xl border" style={{ background: COLORS.surface, borderColor: COLORS.borderTeal }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-bold text-xs" style={{ color: COLORS.ivory }}>Créer un sondage</p>
              <button type="button" onClick={() => setShowPoll(false)} className="p-1" style={{ color: COLORS.muted }}><X size={14} /></button>
            </div>
            <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value.slice(0,300))}
              placeholder="Question du sondage" className="w-full rounded-lg border px-3 py-2 text-xs outline-none mb-2"
              style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
            <div className="space-y-2">
              {pollOptions.map((option,index)=>(
                <div key={index} className="flex gap-2">
                  <input value={option} onChange={(e)=>setPollOptions(prev=>prev.map((v,i)=>i===index?e.target.value.slice(0,120):v))}
                    placeholder={\`Choix \${index+1}\`} className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
                    style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
                  {pollOptions.length>2 && <button type="button" onClick={()=>setPollOptions(prev=>prev.filter((_,i)=>i!==index))} className="p-2" style={{color:COLORS.muted}}><X size={14}/></button>}
                </div>
              ))}
            </div>
            {pollOptions.length<6 && <button type="button" onClick={()=>setPollOptions(prev=>[...prev,""])} className="mt-2 text-[11px] font-bold" style={{color:COLORS.teal}}>+ Ajouter un choix</button>}
          </div>
        )}`,
  "poll composer"
);

replaceOnce(
  '            disabled={(!newText.trim() && !mediaFile) || submitting}',
  '            disabled={(!newText.trim() && !mediaFile && !(showPoll && pollQuestion.trim() && pollOptions.filter((x) => x.trim()).length >= 2)) || submitting}',
  "submit disabled"
);

replaceOnce(
  '      <GuestBanner\n',
  '      {meId && <SocialSuggestions userId={meId} onOpenProfile={onOpenProfile} />}\n\n      <GuestBanner\n',
  "suggestions"
);

replaceOnce(
  String.raw`                {post.media_url && (
                  <div className="rounded-xl overflow-hidden">`,
  String.raw`                <PollCard postId={post.id} userId={meId} />

                {post.media_url && (
                  <div className="rounded-xl overflow-hidden">`,
  "poll card"
);

replaceOnce(
  String.raw`                </div>

                {commentOpen[post.id] && (`,
  String.raw`                </div>

                <SocialPostEnhancements post={post} userId={meId} />

                {commentOpen[post.id] && (`,
  "social actions"
);

fs.writeFileSync(feedPath, src);
console.log("BAARO Social Complete v2 appliqué.");
console.log(`Sauvegarde: ${backupPath}`);
