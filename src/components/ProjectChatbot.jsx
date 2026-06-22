import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, StickyNote, HelpCircle } from 'lucide-react';
import { addProjectNote } from '../utils/notesHelper';
import { useLanguage } from '../utils/LanguageContext';
import './ProjectChatbot.css';

export default function ProjectChatbot({ projects = [], currentUser, userProfile }) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [chatState, setChatState] = useState('IDLE'); // IDLE, AWAITING_PROJECT_FOR_NOTE, AWAITING_NOTE_TEXT
  const [targetSO, setTargetSO] = useState(null);
  const [targetProjectName, setTargetProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial welcome message
  useEffect(() => {
    const isES = language === 'es';
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: isES 
          ? '¡Hola! Soy tu asistente de proyectos. 🤖\n\n¿En qué puedo ayudarte hoy? Puedes preguntarme cosas como:\n• "¿Cómo está el proyecto Eindar Khant?"\n• "Proyectos de Russell"\n• "¿Qué proyectos están ON HOLD?"\n• "Instalaciones de esta semana"\n\nTambién puedes decir "agregar nota" para escribir una nota en la bitácora de algún proyecto.'
          : 'Hi! I am your project assistant. 🤖\n\nHow can I help you today? You can ask me things like:\n• "How is Eindar Khant?"\n• "Projects of Russell"\n• "Which projects are ON HOLD?"\n• "Install dates"\n\nOr say "add note" to log a new note on a project.',
        timestamp: new Date()
      }
    ]);
  }, [language]);

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
      // Look for project matches
      const query = cleanText.replace(/[^a-z0-9]/g, '');
      const matches = projects.filter(p => {
        const cleanName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanSo = p.so.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanName.includes(query) || cleanSo.includes(query);
      });

      if (matches.length === 0) {
        return {
          text: isES 
            ? 'No encontré ningún proyecto con ese nombre o SO. Por favor, intenta de nuevo o escribe "cancelar".'
            : 'No matching project found. Please try again or write "cancel".'
        };
      }

      if (matches.length === 1) {
        const proj = matches[0];
        setTargetSO(proj.so);
        setTargetProjectName(proj.name);
        setChatState('AWAITING_NOTE_TEXT');
        return {
          text: isES 
            ? `Proyecto encontrado: **${proj.name} (SO #${proj.so})**.\n\nEscribe el texto de la nota que deseas agregar:`
            : `Project found: **${proj.name} (SO #${proj.so})**.\n\nType the text of the note you want to add:`
        };
      }

      // Multiple matches
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

      // Add the note
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    }

    // --- IDLE State (General commands) ---

    // Cancel command
    if (cleanText === 'cancelar' || cleanText === 'cancel') {
      return { text: isES ? 'No hay ninguna operación activa.' : 'No active operation to cancel.' };
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

    // On Hold projects query
    if (cleanText.includes('hold') || cleanText.includes('espera') || cleanText.includes('frenado') || cleanText.includes('parado')) {
      const holdProjects = projects.filter(p => p.status === 'ON HOLD');
      if (holdProjects.length === 0) {
        return {
          text: isES ? 'Actualmente no hay ningún proyecto marcado como ON HOLD. 🎉' : 'There are currently no projects marked ON HOLD. 🎉'
        };
      }
      return {
        text: isES
          ? `Aquí están los proyectos en **ON HOLD**:\n\n${holdProjects.map(p => `• **SO #${p.so}**: ${p.name}\n  *Encargado:* ${p.eng || 'Sin asignar'}`).join('\n\n')}`
          : `Here are the projects **ON HOLD**:\n\n${holdProjects.map(p => `• **SO #${p.so}**: ${p.name}\n  *Assigned:* ${p.eng || 'Unassigned'}`).join('\n\n')}`
      };
    }

    // Install Dates query
    if (cleanText.includes('install') || cleanText.includes('fecha') || cleanText.includes('instal') || cleanText.includes('cuando')) {
      // Find installations with dates
      const installs = projects
        .filter(p => p.install && p.install !== '0' && p.install.toLowerCase() !== 'sin fecha')
        .sort((a, b) => new Date(a.install) - new Date(b.install));

      if (installs.length === 0) {
        return {
          text: isES ? 'No tengo registradas fechas de instalación próximas.' : 'No upcoming installation dates registered.'
        };
      }

      return {
        text: isES
          ? `Próximas instalaciones programadas:\n\n${installs.slice(0, 5).map(p => `• **${p.name}**\n  *Fecha:* ${p.install} (SO #${p.so})`).join('\n\n')}`
          : `Upcoming scheduled installations:\n\n${installs.slice(0, 5).map(p => `• **${p.name}**\n  *Date:* ${p.install} (SO #${p.so})`).join('\n\n')}`
      };
    }

    // Projects by designer
    const designerMatch = projects.find(p => p.designer && cleanText.includes(p.designer.toLowerCase()));
    const engMatch = projects.find(p => p.eng && cleanText.includes(p.eng.toLowerCase()));
    const matchingStaff = designerMatch?.designer || engMatch?.eng;

    if (matchingStaff && (cleanText.includes('proyect') || cleanText.includes('trabaj') || cleanText.includes('hace') || cleanText.includes('tiene'))) {
      const staffProjects = projects.filter(p => 
        (p.designer && p.designer.toLowerCase() === matchingStaff.toLowerCase()) || 
        (p.eng && p.eng.toLowerCase() === matchingStaff.toLowerCase())
      );
      if (staffProjects.length === 0) {
        return {
          text: isES 
            ? `No encontré proyectos asignados a **${matchingStaff}**.`
            : `No projects found assigned to **${matchingStaff}**.`
        };
      }
      return {
        text: isES
          ? `Proyectos asignados a **${matchingStaff}**:\n\n${staffProjects.map(p => `• **SO #${p.so}**: ${p.name}\n  *Etapa:* ${p.status || 'Activo'}`).join('\n\n')}`
          : `Projects assigned to **${matchingStaff}**:\n\n${staffProjects.map(p => `• **SO #${p.so}**: ${p.name}\n  *Stage:* ${p.status || 'Active'}`).join('\n\n')}`
      };
    }

    // Specific SO or Project name query (Status check)
    // Filter alphanumeric query
    const searchWord = cleanText.replace(/[^a-z0-9]/g, '');
    if (searchWord.length >= 3) {
      const matched = projects.find(p => {
        const cleanName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanSo = p.so.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanName.includes(searchWord) || cleanSo.includes(searchWord);
      });

      if (matched) {
        return {
          text: isES
            ? `📊 **Proyecto Encontrado:**\n**${matched.name}**\n\n• **SO:** #${matched.so}\n• **Etapa actual:** ${matched.status || 'Activo'}\n• **Diseñador:** ${matched.designer || 'N/A'}\n• **Ingeniero:** ${matched.eng || 'Sin asignar'}\n• **Instalación:** ${matched.install || 'Sin fecha'}`
            : `📊 **Project Found:**\n**${matched.name}**\n\n• **SO:** #${matched.so}\n• **Current Stage:** ${matched.status || 'Active'}\n• **Designer:** ${matched.designer || 'N/A'}\n• **Engineer:** ${matched.eng || 'Unassigned'}\n• **Installation:** ${matched.install || 'No date'}`
        };
      }
    }

    // Help/Fallback
    return {
      text: isES
        ? 'No entendí del todo tu consulta. 🤖\n\nIntenta preguntarme:\n• *"¿Cómo está el proyecto Perez?"*\n• *"Proyectos de Russell"*\n• *"¿Qué está On Hold?"*\n• *o escribe "agregar nota" para agregar una nota a un proyecto.*'
        : 'I didn\'t quite catch that. 🤖\n\nTry asking me:\n• *"How is Perez?"*\n• *"Projects of Russell"*\n• *"What is On Hold?"*\n• *or write "add note" to log a new note.*'
    };
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    // Add user message
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Add temporary bot loading bubble
    const loadingId = 'loading';
    setMessages(prev => [...prev, { id: loadingId, sender: 'bot', text: '...', timestamp: new Date() }]);

    // Process
    const reply = await processInput(text);

    // Replace loading bubble with actual reply
    setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
      id: Date.now().toString(),
      sender: 'bot',
      text: reply.text,
      timestamp: new Date()
    }));
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
        <button className="chatbot-toggle-btn animate-bounce-slow" onClick={() => setIsOpen(true)}>
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
            <button className="btn-icon danger" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Messages body */}
          <div className="chatbot-body">
            {messages.map((m) => (
              <div key={m.id} className={`chat-message ${m.sender}`}>
                <div className="message-avatar">
                  {m.sender === 'bot' ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div className="message-content">
                  <pre className="message-pre">{m.text}</pre>
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
            />
            <button className="chatbot-send-btn" onClick={() => handleSendMessage()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
