import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, StickyNote, HelpCircle } from 'lucide-react';
import { addProjectNote } from '../utils/notesHelper';
import { useLanguage } from '../utils/LanguageContext';
import { askLLM, buildLLMContext, buildManualAnswer } from '../utils/llmChat';
import { useDesignerContacts } from '../utils/useDesignerContacts';
import { appendCapped, nextMessageId, MAX_MESSAGES } from '../utils/chatHistory';
import {
  findLocalEntityMatches,
  resolveProjectForNote,
  isOnHoldQuery,
  isInstallQuery,
  findOnHoldProjects,
  findUpcomingInstalls,
} from '../utils/chatbotLocalMatch';
import './ProjectChatbot.css';

// Renders the tiny markdown subset the bot's own templates use
// (**bold**, *italic*/_italic_) as React elements — no dangerouslySetInnerHTML,
// so arbitrary project/client names in the text can't inject HTML.
function renderInlineMarkdown(line, keyPrefix) {
  const parts = line.split(/(\*\*.+?\*\*|\*.+?\*|_.+?_)/g).filter(p => p !== '');
  return parts.map((part, i) => {
    const key = `${keyPrefix}_${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function FormattedMessage({ text }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {renderInlineMarkdown(line, i)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  );
}

function getHelpText(isES) {
  return isES
    ? 'No entendí del todo tu consulta. 🤖\n\nIntenta preguntarme:\n• *"¿Cómo está el proyecto Perez?"*\n• *"Proyectos de Russell"*\n• *"¿Qué está On Hold?"*\n• *o escribe "agregar nota" para agregar una nota a un proyecto.*'
    : 'I didn\'t quite catch that. 🤖\n\nTry asking me:\n• *"How is Perez?"*\n• *"Projects of Russell"*\n• *"What is On Hold?"*\n• *or write "add note" to log a new note.*';
}

// Builds the reply for a single resolved entity (designer/engineer/project),
// shared between the auto-answer path (single unambiguous match) and the
// multi-option picker's click handler. Also returns `mentionedSO` when the
// entity is a single project, so callers can anchor Gemini's context to it
// for subsequent follow-up questions (see lastMentionedSO).
function buildEntityAnswer(opt, projects, isES) {
  let text = '';
  let mentionedSO = null;
  if (opt.type === 'designer') {
    const activeProjects = projects.filter(p => p.designer === opt.name && p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
    text = isES
      ? `**Proyectos activos de ${opt.name}:**\n\n${activeProjects.length > 0 ? activeProjects.map(p => `• **${p.name}** (SO #${p.so}) - ${p.status}`).join('\n') : 'No tiene proyectos activos.'}`
      : `**Active projects for ${opt.name}:**\n\n${activeProjects.length > 0 ? activeProjects.map(p => `• **${p.name}** (SO #${p.so}) - ${p.status}`).join('\n') : 'No active projects.'}`;
  } else if (opt.type === 'engineer') {
    const activeProjects = projects.filter(p => p.eng === opt.name && p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
    text = isES
      ? `**Proyectos activos de ${opt.name}:**\n\n${activeProjects.length > 0 ? activeProjects.map(p => `• **${p.name}** (SO #${p.so}) - ${p.status}`).join('\n') : 'No tiene proyectos activos.'}`
      : `**Active projects for ${opt.name}:**\n\n${activeProjects.length > 0 ? activeProjects.map(p => `• **${p.name}** (SO #${p.so}) - ${p.status}`).join('\n') : 'No active projects.'}`;
  } else if (opt.type === 'project') {
    const matched = opt.data;
    mentionedSO = matched.so;
    text = isES
      ? `📋 **Proyecto Encontrado:**\n**${matched.name}**\n\n• **SO:** #${matched.so}\n• **Etapa actual:** ${matched.status || 'Activo'}\n• **Diseñador:** ${matched.designer || 'N/A'}\n• **Ingeniero:** ${matched.eng || 'Sin asignar'}\n• **Instalación:** ${matched.install || 'Sin fecha'}`
      : `📋 **Project Found:**\n**${matched.name}**\n\n• **SO:** #${matched.so}\n• **Current Stage:** ${matched.status || 'Active'}\n• **Designer:** ${matched.designer || 'N/A'}\n• **Engineer:** ${matched.eng || 'Unassigned'}\n• **Installation:** ${matched.install || 'No date'}`;
  }
  return { text, mentionedSO };
}

const CHAT_HISTORY_KEY = 'jl_chatbot_history';

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Trim on read too — an oversized history may already be stored from
    // before the cap existed.
    return parsed.slice(-MAX_MESSAGES).map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return null;
  }
}

function buildWelcomeMessage(isES) {
  return {
    id: 'welcome',
    sender: 'bot',
    text: isES
      ? '¡Hola! Soy tu asistente de proyectos. 🤖\n\n¿En qué puedo ayudarte hoy? Puedes preguntarme cosas como:\n• "¿Cómo está el proyecto Eindar Khant?"\n• "Proyectos de Russell"\n• "¿Qué proyectos están ON HOLD?"\n• "Instalaciones de esta semana"\n• "¿Cuál es el reveal de half overlay?" (Manual Técnico de Ingeniería)\n\nTambién puedes decir "agregar nota" para escribir una nota en la bitácora de algún proyecto.'
      : 'Hi! I am your project assistant. 🤖\n\nHow can I help you today? You can ask me things like:\n• "How is Eindar Khant?"\n• "Projects of Russell"\n• "Which projects are ON HOLD?"\n• "Install dates"\n• "What is the half overlay reveal?" (Technical Engineering Manual)\n\nOr say "add note" to log a new note on a project.',
    timestamp: new Date()
  };
}

// Builds the reply for a designer contact lookup (phone/email/city), shared
// so "natalie contact" resolves locally and instantly instead of depending
// on the Gemini proxy (which silently falls back to the help message if
// GEMINI_API_KEY isn't configured — see buildContactsSection in llmChat.js
// for the equivalent match used to ground the LLM context).
function buildContactAnswer(contact, isES) {
  return isES
    ? `📇 **Contacto de Diseñador:**\n**${contact.name}**\n\n• **Tel:** ${contact.phone || 'N/A'}\n• **Email:** ${contact.email || 'N/A'}\n• **Ciudad:** ${contact.city || 'N/A'}`
    : `📇 **Designer Contact:**\n**${contact.name}**\n\n• **Phone:** ${contact.phone || 'N/A'}\n• **Email:** ${contact.email || 'N/A'}\n• **City:** ${contact.city || 'N/A'}`;
}

// Human-readable label for a picker option. Kept next to the answer builders
// because it's presentation — findLocalEntityMatches returns language-agnostic
// options and the component labels them.
function labelForOption(opt, isES) {
  switch (opt.type) {
    case 'designer':
      return isES ? `Ver proyectos de ${opt.name} (Diseñador)` : `View projects for ${opt.name} (Designer)`;
    case 'engineer':
      return isES ? `Ver proyectos de ${opt.name} (Ingeniero)` : `View projects for ${opt.name} (Engineer)`;
    case 'project':
      return isES ? `Ver proyecto ${opt.data.name} (SO #${opt.data.so})` : `View project ${opt.data.name} (SO #${opt.data.so})`;
    case 'contact':
      return isES ? `Ver contacto de ${opt.data.name} (Diseñador)` : `View contact for ${opt.data.name} (Designer)`;
    default:
      return '';
  }
}

// Builds the reply for the "ON HOLD" chip / query — a local list of every
// project currently on hold, so it no longer falls through to Gemini.
function buildOnHoldAnswer(onHoldProjects, isES) {
  if (onHoldProjects.length === 0) {
    return isES
      ? '✅ No hay proyectos ON HOLD en este momento.'
      : '✅ There are no projects ON HOLD right now.';
  }
  const lines = onHoldProjects
    .map(p => `• **${p.name}** (SO #${p.so})${p.eng ? ` — ${p.eng}` : ''}`)
    .join('\n');
  return isES
    ? `⚠️ **Proyectos ON HOLD (${onHoldProjects.length}):**\n\n${lines}`
    : `⚠️ **Projects ON HOLD (${onHoldProjects.length}):**\n\n${lines}`;
}

// Builds the reply for the "Installations" chip / query — a local list of
// upcoming installs (soonest first), capped so the bubble stays readable.
function buildInstallAnswer(installs, isES) {
  if (installs.length === 0) {
    return isES
      ? '📅 No encontré instalaciones próximas programadas.'
      : '📅 I could not find any upcoming installations scheduled.';
  }
  const shown = installs.slice(0, 10);
  const lines = shown
    .map(p => `• **${p.install}** — ${p.name} (SO #${p.so})${p.eng ? ` — ${p.eng}` : ''}`)
    .join('\n');
  const more = installs.length > shown.length
    ? (isES ? `\n\n…y ${installs.length - shown.length} más.` : `\n\n…and ${installs.length - shown.length} more.`)
    : '';
  return isES
    ? `📅 **Próximas Instalaciones (${installs.length}):**\n\n${lines}${more}`
    : `📅 **Upcoming Installations (${installs.length}):**\n\n${lines}${more}`;
}

export default function ProjectChatbot({ projects = [], materialsMatrix = [], currentUser, userProfile }) {
  const { language } = useLanguage();
  const { contacts: designerContacts } = useDesignerContacts();
  const [isOpen, setIsOpen] = useState(false);
  // Starts empty rather than seeded with the welcome message: the welcome is
  // derived at render time (see displayMessages) so it always follows the
  // current language. Seeding it into state froze it in whatever language the
  // widget first mounted in.
  const [messages, setMessages] = useState(() => loadStoredMessages() || []);
  const [inputValue, setInputValue] = useState('');
  const [chatState, setChatState] = useState('IDLE'); // IDLE, AWAITING_PROJECT_FOR_NOTE, AWAITING_NOTE_TEXT
  const [targetSO, setTargetSO] = useState(null);
  const [targetProjectName, setTargetProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Tracks the last project the user was shown (single-match answer or picker
  // selection), so short follow-up questions ("¿cuándo instala?") can anchor
  // Gemini's context to that project instead of relying on it inferring the
  // subject purely from free-text history — see buildLLMContext's
  // `anchoredProject` param.
  const [lastMentionedSO, setLastMentionedSO] = useState(null);
  // Same idea as lastMentionedSO, but for a designer contact the user was just
  // shown (local lookup or picker selection). A contact reply is answered
  // locally and never enters Gemini's history, so a follow-up like "¿y su
  // teléfono?" needs this to anchor who "su" is — see buildAnchoredContactSection.
  const [lastMentionedContact, setLastMentionedContact] = useState(null);

  const messagesEndRef = useRef(null);

  // The welcome bubble is shown, not stored: deriving it here means a language
  // switch re-renders it in the new language, while real conversation turns
  // stay exactly as they were said.
  const displayMessages = messages.length === 0
    ? [buildWelcomeMessage(language === 'es')]
    : messages;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist history across page reloads / widget close-reopen (session-lasting).
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error('Chatbot: failed to persist history to localStorage:', err);
    }
  }, [messages]);


  // Get current username
  const getUserName = () => {
    return userProfile?.designerName || currentUser?.displayName || currentUser?.email || 'Diseñador';
  };

  // Chat Processing Logic (NLP local)
  const processInput = async (text) => {
    const isES = language === 'es';
    const cleanText = text.trim().toLowerCase();

    // 1. Multi-turn State Machine for Adding Notes
    if (chatState === 'AWAITING_PROJECT_FOR_NOTE') {
      // Cancel must be checked BEFORE attempting a project-name match, same as
      // AWAITING_NOTE_TEXT below — otherwise "cancelar"/"cancel" gets treated
      // as a failed project search and the bot loops forever suggesting the
      // user type "cancelar" (which never actually gets checked).
      if (cleanText === 'cancelar' || cleanText === 'cancel') {
        setChatState('IDLE');
        setTargetSO(null);
        setTargetProjectName('');
        return {
          text: isES ? 'Acción cancelada.' : 'Action cancelled.'
        };
      }

      // Resolve which project the note goes on. `best` is set only when one
      // candidate clearly outranks the rest (exact SO/name, or a wide enough
      // margin) — otherwise we ask rather than risk filing the note on the
      // wrong project. `matches` is ranked best-first for the picker.
      const { matches, best } = resolveProjectForNote(text, projects);

      if (matches.length === 0) {
        return {
          text: isES
            ? 'No encontré ningún proyecto con ese nombre o SO. Por favor, intenta de nuevo o escribe "cancelar".'
            : 'No matching project found. Please try again or write "cancel".'
        };
      }

      if (best) {
        setTargetSO(best.so);
        setTargetProjectName(best.name);
        setChatState('AWAITING_NOTE_TEXT');
        return {
          text: isES
            ? `Proyecto encontrado: **${best.name} (SO #${best.so})**.\n\nEscribe el texto de la nota que deseas agregar:`
            : `Project found: **${best.name} (SO #${best.so})**.\n\nType the text of the note you want to add:`
        };
      }

      // Genuinely ambiguous — list candidates, most likely first.
      return {
        text: isES
          ? `Encontré múltiples coincidencias. Por favor selecciona el número de SO correcto:\n\n${matches.map(m => `• **SO #${m.so}**: ${m.name}`).join('\n')}`
          : `Found multiple matches. Please select the correct SO number:\n\n${matches.map(m => `• **SO #${m.so}**: ${m.name}`).join('\n')}`
      };
    }

    if (chatState === 'AWAITING_NOTE_TEXT') {
      if (cleanText === 'cancelar' || cleanText === 'cancel') {
        setChatState('IDLE');
        setTargetSO(null);
        setTargetProjectName('');
        return {
          text: isES ? 'Acción cancelada.' : 'Action cancelled.'
        };
      }

      // Add the note. Loading state is managed by the enclosing
      // handleSendMessage (which disables input for the whole cycle), so it's
      // not toggled again here.
      try {
        await addProjectNote(targetSO, text, getUserName());
        setChatState('IDLE');
        const projName = targetProjectName;
        setTargetSO(null);
        setTargetProjectName('');
        return {
          text: isES
            ? `✅ ¡Nota agregada con éxito al proyecto **${projName}**!\n\nYa puedes verla en la bitácora de notas de la tarjeta.`
            : `✅ Note successfully added to **${projName}**!\n\nYou can now see it in the notes section of the project card.`
        };
      } catch (err) {
        console.error(err);
        return {
          text: isES ? 'Hubo un error al guardar la nota. Inténtalo de nuevo.' : 'Error saving the note. Please try again.'
        };
      }
    }

    // --- IDLE State (General commands) ---

    // Cancel command
    if (cleanText === 'cancelar' || cleanText === 'cancel') {
      return { text: isES ? 'No hay ninguna operación activa.' : 'No active operation to cancel.' };
    }

    // Help command (also used by the "Help"/"Ayuda" quick-action chip)
    if (cleanText === 'ayuda' || cleanText === 'help' || cleanText === '?') {
      return { text: getHelpText(isES) };
    }

    // Add note trigger
    if (cleanText.includes('nota') || cleanText.includes('note') || cleanText.includes('bitacora')) {
      setChatState('AWAITING_PROJECT_FOR_NOTE');
      return {
        text: isES 
          ? 'Perfecto. ¿A qué proyecto (escribe el nombre o el número de SO) deseas agregarle la nota?'
          : 'Perfect. Which project (type the name or SO number) do you want to add the note to?'
      };
    }

    // Entity search (designer / engineer / project / designer contact). The
    // matching itself lives in findLocalEntityMatches — shared with its test
    // suite — and returns options already ranked best-first; here we only turn
    // them into a reply. Trigger phrases ("how is", "proyectos de") are
    // stripped before matching, and long paragraphs are guarded off there.
    const rawOptions = findLocalEntityMatches(text, { projects, designerContacts });
    const options = rawOptions.options.map(o => ({ ...o, label: labelForOption(o, isES) }));

    // Answer directly when one option clearly wins: either it's the only
    // candidate, or it correlates with more of the query than the runner-up
    // ("ana ball" → Ana Ball hits both words, Bob Ball only one). Equal scores
    // mean the query genuinely doesn't disambiguate, so show the picker.
    const isSingleWinner = options.length === 1
      || (options.length > 1 && options[0].score > options[1].score);

    if (isSingleWinner) {
      const winner = options[0];
      if (winner.type === 'contact') {
        // Anchor this contact for follow-ups ("¿y su teléfono?") and clear
        // any project anchor so the two don't compete for the same "su".
        setLastMentionedContact(winner.data.name);
        setLastMentionedSO(null);
        return { text: buildContactAnswer(winner.data, isES) };
      }
      const { text: answerText, mentionedSO } = buildEntityAnswer(winner, projects, isES);
      if (mentionedSO) {
        setLastMentionedSO(mentionedSO);
        setLastMentionedContact(null);
      }
      return { text: answerText };
    }

    if (options.length > 1) {
      return {
        text: isES ? `Encontré resultados para "${text.trim()}". Selecciona una opción:` : `Found results for "${text.trim()}". Select an option:`,
        options: options
      };
    }

    // Aggregate-intent queries (ON HOLD list, upcoming installs) — these back
    // the corresponding quick-action chips. Checked AFTER the entity search so
    // a named lookup ("proyecto Hale") still wins, but BEFORE Gemini so the
    // chips resolve locally instead of falling through to the LLM.
    if (isOnHoldQuery(text)) {
      return { text: buildOnHoldAnswer(findOnHoldProjects(projects), isES) };
    }
    if (isInstallQuery(text)) {
      return { text: buildInstallAnswer(findUpcomingInstalls(projects), isES) };
    }

    // Engineering-manual questions — answered locally straight from the matched
    // section when searchEngineeringManual finds a clear hit (its scoring is
    // strict enough not to fire on project/greeting queries). The manual text
    // is authoritative and pre-written, so this works even when Gemini is down;
    // unrecognized manual phrasings still fall through to the LLM below.
    const manualAnswer = buildManualAnswer(text, isES);
    if (manualAnswer) {
      return { text: manualAnswer };
    }

    // Main path: hand off to the Gemini-backed LLM proxy, grounded with a
    // context block covering projects, the engineering manual, the materials
    // matrix, and designer contacts — plus recent conversation history so
    // follow-up questions ("and the designer?") stay coherent. If the proxy
    // is unavailable (no API key configured, network error), fall back to
    // the static help message instead of failing silently.
    try {
      const context = buildLLMContext({ query: text, projects, materialsMatrix, designerContacts, isES, anchoredSO: lastMentionedSO, anchoredContactName: lastMentionedContact });
      // Gemini's contents array requires strict user/model alternation
      // starting with 'user' — a locally-answered turn (entity picker, "add
      // note" flow, ON HOLD chip, etc.) never went through Gemini and its bot
      // reply isn't a valid 'model' turn to hand back to it. Only replay
      // pairs where the bot reply is explicitly flagged viaLLM, and always
      // pair each with the user message that immediately preceded it so the
      // sequence alternates correctly.
      const history = [];
      const recent = messages.filter(m => m.id !== 'welcome' && m.id !== 'loading' && m.text !== '...');
      for (let i = 0; i < recent.length; i++) {
        const m = recent[i];
        if (m.sender === 'bot' && m.viaLLM) {
          const prevUser = recent[i - 1];
          if (prevUser && prevUser.sender === 'user') {
            history.push({ role: 'user', text: prevUser.text });
            history.push({ role: 'model', text: m.text });
          }
        }
      }
      const trimmedHistory = history.slice(-6);
      const llmReply = await askLLM({ message: text, language, context, history: trimmedHistory });
      if (llmReply) {
        return { text: llmReply, viaLLM: true };
      }
    } catch (err) {
      console.error('LLM fallback failed:', err);
      // Surface real infrastructure failures distinctly from a genuine "I
      // didn't understand" miss — otherwise both look identical to the user
      // and this class of outage is indistinguishable from normal NLU misses.
      if (err.status === 401) {
        return {
          text: isES
            ? '⚠️ Tu sesión expiró. Recargá la página para volver a iniciar sesión.'
            : '⚠️ Your session expired. Please reload the page to sign in again.'
        };
      }
      // 503: Gemini itself was overloaded even after the proxy's retries. It's
      // transient and unrelated to what the user asked, so say so plainly
      // rather than implying their question was the problem.
      if (err.status === 503) {
        return {
          text: isES
            ? '⚠️ El asistente está sobrecargado en este momento. Volvé a intentar en unos segundos — no es un problema con tu consulta.'
            : '⚠️ The assistant is overloaded right now. Try again in a few seconds — nothing is wrong with your question.'
        };
      }
      if (err.status === 502 || err.status === 500) {
        return {
          text: isES
            ? '⚠️ El asistente no puede conectarse en este momento (error del servidor). Probá de nuevo en unos minutos, o usá los botones rápidos de abajo.'
            : '⚠️ The assistant can\'t connect right now (server error). Try again in a few minutes, or use the quick-action buttons below.'
        };
      }
      if (err.status === 429) {
        return {
          text: isES
            ? '⚠️ Demasiadas consultas por ahora. Esperá un momento y volvé a intentar.'
            : '⚠️ Too many requests right now. Wait a moment and try again.'
        };
      }
    }

    return { text: getHelpText(isES) };
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;
    // Guard against a second send while one is still in flight (a slow Gemini
    // call, a note write) — otherwise messages can interleave and the "add
    // note" state machine can be driven mid-step. The input/send button are
    // disabled on isLoading too, but this also covers Enter-key and chip taps.
    if (isLoading) return;
    setIsLoading(true);

    // Add user message
    const userMsg = {
      id: nextMessageId(),
      sender: 'user',
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => appendCapped(prev, userMsg));
    setInputValue('');

    // Add temporary bot loading bubble
    const loadingId = 'loading';
    setMessages(prev => appendCapped(prev, { id: loadingId, sender: 'bot', text: '...', timestamp: new Date() }));

    // Process. Any uncaught error must still replace the "..." bubble —
    // otherwise it stays stuck forever and the user gets no feedback.
    let reply;
    try {
      reply = await processInput(text);
    } catch (err) {
      console.error('processInput crashed:', err);
      const isES = language === 'es';
      reply = {
        text: isES
          ? '⚠️ Ocurrió un error inesperado al procesar tu mensaje. Probá de nuevo o usá los botones rápidos.'
          : '⚠️ An unexpected error occurred while processing your message. Try again or use the quick-action buttons.'
      };
    } finally {
      setIsLoading(false);
    }

    // Replace loading bubble with actual reply
    setMessages(prev => prev.map(m => m.id === loadingId ? {
      id: nextMessageId(),
      sender: 'bot',
      text: reply.text,
      options: reply.options,
      viaLLM: !!reply.viaLLM,
      timestamp: new Date()
    } : m));
  };

  const handleOptionClick = (opt) => {
    const isES = language === 'es';
    // Same in-flight guard handleSendMessage uses: picker buttons stay
    // clickable while a Gemini call is pending, and appending a picker answer
    // mid-request interleaves it with the reply that's about to land.
    if (isLoading) return;

    if (opt.type === 'contact') {
      setLastMentionedContact(opt.data.name);
      setLastMentionedSO(null);
      setMessages(prev => appendCapped(prev,
        { id: nextMessageId('_user'), sender: 'user', text: opt.label, timestamp: new Date() },
        { id: nextMessageId('_bot'), sender: 'bot', text: buildContactAnswer(opt.data, isES), timestamp: new Date() }
      ));
      return;
    }
    const { text: responseText, mentionedSO } = buildEntityAnswer(opt, projects, isES);
    if (mentionedSO) {
      setLastMentionedSO(mentionedSO);
      setLastMentionedContact(null);
    }

    setMessages(prev => appendCapped(prev,
      { id: nextMessageId('_user'), sender: 'user', text: opt.label, timestamp: new Date() },
      { id: nextMessageId('_bot'), sender: 'bot', text: responseText, timestamp: new Date() }
    ));
  };

  const handleChipClick = (action) => {
    const isES = language === 'es';
    if (action === 'hold') {
      handleSendMessage(isES ? '¿Qué proyectos están ON HOLD?' : 'Which projects are ON HOLD?');
    } else if (action === 'install') {
      handleSendMessage(isES ? 'Instalaciones programadas' : 'Installation dates');
    } else if (action === 'note') {
      handleSendMessage(isES ? 'Agregar nota' : 'Add note');
    } else if (action === 'help') {
      handleSendMessage(isES ? 'Ayuda' : 'Help');
    }
  };

  return (
    <div className="project-chatbot-widget">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button className="chatbot-toggle-btn animate-bounce-slow" onClick={() => setIsOpen(true)} aria-label={language === 'es' ? 'Abrir chat de asistente' : 'Open assistant chat'}>
          <MessageSquare size={26} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window animate-slide-up">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-profile">
              <div className="bot-avatar">
                <Bot size={18} />
              </div>
              <div className="bot-info">
                <h4>Asistente JL</h4>
                <div className="online-indicator">
                  <span className="dot"></span> Online
                </div>
              </div>
            </div>
            <button className="btn-icon danger" onClick={() => setIsOpen(false)} aria-label={language === 'es' ? 'Cerrar chat' : 'Close chat'}>
              <X size={18} />
            </button>
          </div>

          {/* Messages body */}
          <div className="chatbot-body">
            {displayMessages.map((m) => (
              <div key={m.id} className={`chat-message ${m.sender}`}>
                <div className="message-avatar">
                  {m.sender === 'bot' ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div className="message-content">
                  <div className="message-pre"><FormattedMessage text={m.text} /></div>
                  {m.options && m.options.length > 0 && (
                    <div className="message-options">
                      {m.options.map((opt) => (
                        <button 
                          key={opt.id} 
                          className="chatbot-option-btn" 
                          onClick={() => handleOptionClick(opt)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick action chips */}
          <div className="chatbot-chips">
            <button className="chatbot-chip" onClick={() => handleChipClick('note')}>
              <StickyNote size={12} />
              {language === 'es' ? 'Agregar Nota' : 'Add Note'}
            </button>
            <button className="chatbot-chip" onClick={() => handleChipClick('hold')}>
              ⚠️ {language === 'es' ? 'Ver ON HOLD' : 'ON HOLD'}
            </button>
            <button className="chatbot-chip" onClick={() => handleChipClick('install')}>
              📅 {language === 'es' ? 'Instalaciones' : 'Installs'}
            </button>
            <button className="chatbot-chip" onClick={() => handleChipClick('help')}>
              <HelpCircle size={12} />
              {language === 'es' ? 'Ayuda' : 'Help'}
            </button>
          </div>

          {/* Input Footer */}
          <div className="chatbot-footer">
            <input
              type="text"
              placeholder={
                chatState === 'AWAITING_PROJECT_FOR_NOTE'
                  ? (language === 'es' ? 'Escribe el nombre o SO...' : 'Type name or SO...')
                  : chatState === 'AWAITING_NOTE_TEXT'
                  ? (language === 'es' ? 'Escribe la nota...' : 'Type the note...')
                  : (language === 'es' ? 'Pregúntame algo...' : 'Ask me something...')
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              disabled={isLoading}
            />
            <button className="chatbot-send-btn" onClick={() => handleSendMessage()} disabled={isLoading} aria-label={language === 'es' ? 'Enviar mensaje' : 'Send message'}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
