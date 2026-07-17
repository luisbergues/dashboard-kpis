// Sheet Name cells arrive as "Cliente:[SO#] Nombre" (e.g. "Chris
// Jaensch:[12112] Chris Jaensch"); views show only the client part.
// PapaParse hands back a number for purely-numeric cells, hence String(?? '').
export const shortProjectName = (name) => String(name ?? '').split(':')[0].trim();
