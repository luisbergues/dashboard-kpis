import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, StickyNote, HelpCircle } from 'lucide-react';
import { addProjectNote } from '../utils/notesHelper';
import { useLanguage } from '../utils/LanguageContext';
import './ProjectChatbot.css';

const DESIGNERS_CONTACTS = [
  { name: 'Monica Gabriel', phone: '954-678-8432', email: 'mgabriel@jlclosets.com', city: 'BOCA RATON' },
  { name: 'Natalie Ball', phone: '954-899-7307', email: 'nball@jlclosets.com', city: 'CORAL SPRINGS' },
  { name: 'Marsha Diquez', phone: '754-779-0502', email: 'mdiquez@jlclosets.com', city: 'COCONUT CK' },
  { name: 'Iris Lopes', phone: '786-280-4004', email: 'ilopes@jlclosets.com', city: 'DEERFIELD BCH' },
  { name: 'Kat Baumgartner', phone: '270-991-1002', email: 'kbaumgartner@jlclosets.com', city: 'DANIA BEACH' },
  { name: 'Melissa Barker', phone: '561-587-0632', email: 'mbarker@jlclosets.com', city: 'DELRAY BEACH' },
  { name: 'Nicole Dugan', phone: '239-788-4114', email: 'ndugan@jlclosets.com', city: 'FORT MYERS' },
  { name: 'Tricia Hatton', phone: '561-324-0033', email: 'thatton@jlclosets.com', city: 'LAKE WORTH' },
  { name: 'Blerta Veseli', phone: '561-971-0525', email: 'bveseli@jlclosets.com', city: 'MIAMI' },
  { name: 'Lana Kravtchenko', phone: '646-309-5301', email: 'lkravtchenko@jlclosets.com', city: 'MIAMI' },
  { name: 'Krisztina Vizi', phone: '561-537-6787', email: 'kvizi@jlclosets.com', city: 'PALM BEACH' },
  { name: 'Luana Tamagnone', phone: '561-816-1779', email: 'ltamagnone@jlclosets.com', city: 'W. PALM BEACH' },
  { name: 'Russell Reiner', phone: '561-350-7999', email: 'rreiner@jlclosets.com', city: 'PALM BEACH' },
  { name: 'Mauricio Dasso', phone: '203-561-9581', email: 'mdasso@jlclosets.com', city: 'PALM BEACH' },
  { name: 'Sarah Manev', phone: '561-306-6192', email: 'smanev@jlclosets.com', city: 'PARKLAND' },
  { name: 'Caryn Henslovitz', phone: '945-290-7997', email: 'chenslovitz@jlclosets.com', city: 'PARKLAND' },
  { name: 'Michael Kaboskey', phone: '954-257-5087', email: 'mkaboskey@jlclosets.com', city: 'PORT ST. LUCIE' },
  { name: 'Malanie Dalfrey', phone: '772-278-6949', email: 'mdalfrey@jlclosets.com', city: 'PORT ST. LUCIE' }
];

export default function ProjectChatbot({ projects = [], materialsMatrix = [], currentUser, userProfile }) {
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

    // Materials Matrix Query
    if (cleanText.includes('matrix') || cleanText.includes('materials') || cleanText.includes('materiales') || cleanText.includes('matriz') || cleanText.includes('meterial') || cleanText.includes('material')) {
      const matchedMaterial = materialsMatrix.find(m => {
        const cleanName = (m.projectName || '').toLowerCase().trim();
        const cleanSo = (m.so || '').toLowerCase().trim();
        
        if (cleanSo && cleanText.includes(cleanSo)) return true;
        
        const nameParts = cleanName.split(' ').filter(part => part.length >= 3);
        if (nameParts.length > 0 && nameParts.some(part => cleanText.includes(part))) return true;
        
        return false;
      });

      if (matchedMaterial) {
        return {
          text: isES
            ? `🪵 **Materiales para ${matchedMaterial.projectName} (SO #${matchedMaterial.so})**:\n• **Thermofoil:** ${matchedMaterial.thermofoil || 'No'}\n• **No Holes:** ${matchedMaterial.noHoles || 'No'}\n• **Dovetail:** ${matchedMaterial.dovetail || 'No'}\n• **Element:** ${matchedMaterial.element || 'No'}`
            : `🪵 **Materials for ${matchedMaterial.projectName} (SO #${matchedMaterial.so})**:\n• **Thermofoil:** ${matchedMaterial.thermofoil || 'No'}\n• **No Holes:** ${matchedMaterial.noHoles || 'No'}\n• **Dovetail:** ${matchedMaterial.dovetail || 'No'}\n• **Element:** ${matchedMaterial.element || 'No'}`
        };
      }

      return {
        text: isES 
          ? 'Para consultar la Matrix de Materiales, dime el nombre o SO del proyecto. (Ej: "materiales del proyecto 12510" o "materials matrix Perez")'
          : 'To check the Materials Matrix, tell me the project name or SO. (e.g. "materials for 12510" or "materials matrix Perez")'
      };
    }

    // Designer Contact Query
    if (cleanText.includes('contacto') || cleanText.includes('telefono') || cleanText.includes('email') || cleanText.includes('diseñador') || cleanText.includes('designer') || cleanText.includes('contact')) {
      const mentionedDesigner = DESIGNERS_CONTACTS.find(d => {
        const firstName = d.name.split(' ')[0].toLowerCase();
        const lastName = d.name.split(' ')[1].toLowerCase();
        return cleanText.includes(firstName) || cleanText.includes(lastName);
      });

      if (mentionedDesigner) {
        return {
          text: isES
            ? `📞 **Contacto de ${mentionedDesigner.name}**:\n• **Tel:** ${mentionedDesigner.phone}\n• **Email:** ${mentionedDesigner.email}\n• **Ciudad:** ${mentionedDesigner.city}`
            : `📞 **Contact for ${mentionedDesigner.name}**:\n• **Phone:** ${mentionedDesigner.phone}\n• **Email:** ${mentionedDesigner.email}\n• **City:** ${mentionedDesigner.city}`
        };
      }
      
      if (cleanText.includes('lista') || cleanText.includes('list') || cleanText.includes('todos') || cleanText.includes('all')) {
         return {
           text: isES
             ? `Tengo el contacto de ${DESIGNERS_CONTACTS.length} diseñadores. Pregúntame por el nombre de uno en específico (Ej: "contacto de Russell").`
             : `I have contact info for ${DESIGNERS_CONTACTS.length} designers. Ask me for a specific name (e.g., "contact Russell").`
         }
      }
    }

    // Complex/Multi-condition Query Pipeline
    const mentionedStaff = [];
    projects.forEach(p => {
      if (p.designer && p.designer.trim() !== '') {
        const dName = p.designer.toLowerCase().split(' ')[0];
        if (cleanText.includes(dName) && !mentionedStaff.includes(dName)) mentionedStaff.push(dName);
      }
      if (p.eng && p.eng.trim() !== '') {
        const eName = p.eng.toLowerCase().split(' ')[0];
        if (cleanText.includes(eName) && !mentionedStaff.includes(eName)) mentionedStaff.push(eName);
      }
    });

    const isHold = cleanText.includes('hold') || cleanText.includes('espera') || cleanText.includes('frenado') || cleanText.includes('parado');
    const isSoonest = cleanText.includes('sooner') || cleanText.includes('soonest') || cleanText.includes('próximo') || cleanText.includes('proximo') || cleanText.includes('first');
    const isInstall = cleanText.includes('install') || cleanText.includes('fecha') || cleanText.includes('instal') || cleanText.includes('cuando') || isSoonest;
    const isProjectMention = cleanText.includes('proyect') || cleanText.includes('project') || cleanText.includes('trabaj') || cleanText.includes('tiene');

    let appliedFilters = 0;
    let filteredProjects = [...projects];

    if (mentionedStaff.length > 0) {
      filteredProjects = filteredProjects.filter(p => {
        return mentionedStaff.every(staff => 
          (p.designer && p.designer.toLowerCase().includes(staff)) || 
          (p.eng && p.eng.toLowerCase().includes(staff))
        );
      });
      appliedFilters++;
    }

    if (isHold) {
      filteredProjects = filteredProjects.filter(p => p.status === 'ON HOLD');
      appliedFilters++;
    }

    if (isInstall) {
      filteredProjects = filteredProjects.filter(p => p.install && p.install !== '0' && p.install.toLowerCase() !== 'sin fecha');
      filteredProjects.sort((a, b) => new Date(a.install) - new Date(b.install));
      appliedFilters++;
    }

    if (appliedFilters > 0 && (isHold || isInstall || (mentionedStaff.length > 0 && isProjectMention))) {
      if (filteredProjects.length === 0) {
        return {
          text: isES ? 'No encontré ningún proyecto que cumpla con todos esos criterios.' : 'I found no projects matching all those criteria.'
        };
      }

      if (isSoonest) {
        const p = filteredProjects[0];
        return {
          text: isES 
            ? `El proyecto que cumple tus criterios con la fecha de instalación más próxima es:\n\n• **${p.name}**\n  *SO:* #${p.so}\n  *Instalación:* ${p.install}\n  *Etapa:* ${p.status}`
            : `The project matching your criteria with the soonest installation date is:\n\n• **${p.name}**\n  *SO:* #${p.so}\n  *Install:* ${p.install}\n  *Stage:* ${p.status}`
        };
      }

      const limit = 5;
      const displayProjects = filteredProjects.slice(0, limit);
      
      return {
        text: isES
          ? `Encontré ${filteredProjects.length} proyectos con esos criterios. ${filteredProjects.length > limit ? `(Mostrando los primeros ${limit})` : ''}\n\n${displayProjects.map(p => `• **SO #${p.so}**: ${p.name}\n  *Instalación:* ${p.install || 'Sin fecha'}\n  *Etapa:* ${p.status}`).join('\n\n')}`
          : `I found ${filteredProjects.length} projects matching those criteria. ${filteredProjects.length > limit ? `(Showing first ${limit})` : ''}\n\n${displayProjects.map(p => `• **SO #${p.so}**: ${p.name}\n  *Install:* ${p.install || 'No date'}\n  *Stage:* ${p.status}`).join('\n\n')}`
      };
    }

    // Specific SO or Project name query (Status check)
    // Entity Search (Designer, Engineer, Project)
    const searchWord = cleanText.replace(/[^a-z0-9]/g, '');
    if (searchWord.length >= 3) {
      let options = [];
      let optionIdCounter = 1;

      // Check Engineers
      const matchedEngineers = [...new Set(projects.filter(p => p.eng && p.eng.toLowerCase().replace(/[^a-z0-9]/g, '').includes(searchWord)).map(p => p.eng))];
      matchedEngineers.forEach(e => {
        options.push({ id: optionIdCounter++, type: 'engineer', name: e, label: isES ? `Ver proyectos de ${e} (Ingeniero)` : `View projects for ${e} (Engineer)` });
      });

      // Check Projects
      const matchedProjects = projects.filter(p => {
        const cleanName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanSo = p.so.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanName.includes(searchWord) || cleanSo.includes(searchWord);
      });
      matchedProjects.forEach(p => {
        options.push({ id: optionIdCounter++, type: 'project', data: p, label: isES ? `Ver proyecto ${p.name} (SO #${p.so})` : `View project ${p.name} (SO #${p.so})` });
      });

      if (options.length > 0) {
        return {
          text: isES ? `Encontré resultados para "${text.trim()}". Selecciona una opción:` : `Found results for "${text.trim()}". Select an option:`,
          options: options
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
    setMessages(prev => prev.map(m => m.id === loadingId ? {
      id: Date.now().toString(),
      sender: 'bot',
      text: reply.text,
      options: reply.options,
      timestamp: new Date()
    } : m));
  };

  const handleOptionClick = (opt) => {
    const isES = language === 'es';
    let responseText = '';

    if (opt.type === 'engineer') {
      const activeProjects = projects.filter(p => p.eng === opt.name && p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
      responseText = isES 
        ? `**Proyectos activos de ${opt.name}:**\n\n${activeProjects.length > 0 ? activeProjects.map(p => `• **${p.name}** (SO #${p.so}) - ${p.status}`).join('\n') : 'No tiene proyectos activos.'}`
        : `**Active projects for ${opt.name}:**\n\n${activeProjects.length > 0 ? activeProjects.map(p => `• **${p.name}** (SO #${p.so}) - ${p.status}`).join('\n') : 'No active projects.'}`;
    } else if (opt.type === 'project') {
      const matched = opt.data;
      responseText = isES
        ? `📋 **Proyecto Encontrado:**\n**${matched.name}**\n\n• **SO:** #${matched.so}\n• **Etapa actual:** ${matched.status || 'Activo'}\n• **Diseñador:** ${matched.designer || 'N/A'}\n• **Ingeniero:** ${matched.eng || 'Sin asignar'}\n• **Instalación:** ${matched.install || 'Sin fecha'}`
        : `📋 **Project Found:**\n**${matched.name}**\n\n• **SO:** #${matched.so}\n• **Current Stage:** ${matched.status || 'Active'}\n• **Designer:** ${matched.designer || 'N/A'}\n• **Engineer:** ${matched.eng || 'Unassigned'}\n• **Installation:** ${matched.install || 'No date'}`;
    }

    setMessages(prev => [...prev, 
      { id: Date.now().toString() + '_user', sender: 'user', text: opt.label, timestamp: new Date() },
      { id: Date.now().toString() + '_bot', sender: 'bot', text: responseText, timestamp: new Date() }
    ]);
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
