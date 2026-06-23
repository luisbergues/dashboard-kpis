import { backupDb } from './firebaseBackup';
import { collection, doc, setDoc, getDocs, Timestamp } from 'firebase/firestore';

export async function archiveMissingCompletedProjects(previousData, newData) {
  if (!backupDb || !previousData || !newData) return;

  try {
    const prevProjects = previousData.priorityAnalysis || [];
    const newProjects = newData.priorityAnalysis || [];

    const newSoMap = new Set(newProjects.map(p => p.so));

    // Find projects that were in previousData, had status Completed, and are missing from newData
    const completedAndDeleted = prevProjects.filter(p => 
      p.status && p.status.toLowerCase() === 'completed' && !newSoMap.has(p.so)
    );

    if (completedAndDeleted.length > 0) {
      console.log(`📦 Archiving ${completedAndDeleted.length} completed projects to Firestore...`);
      const batchPromises = completedAndDeleted.map(project => {
        const docRef = doc(collection(backupDb, 'completed_projects_archive'), project.so.toString());
        // Store the project data along with an archive timestamp
        return setDoc(docRef, {
          ...project,
          archivedAt: Timestamp.now()
        }, { merge: true });
      });
      
      await Promise.all(batchPromises);
      console.log('✅ Completed projects successfully archived.');
    }
  } catch (error) {
    console.error('❌ Error archiving completed projects:', error);
  }
}

export async function fetchArchivedCompletedProjects() {
  if (!backupDb) return [];

  try {
    const archiveRef = collection(backupDb, 'completed_projects_archive');
    // Fetch all and filter in memory to avoid needing composite indexes.
    const querySnapshot = await getDocs(archiveRef);
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const archivedProjects = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const archivedAt = data.archivedAt?.toDate();
      
      // If no archivedAt exists or it's within 6 months, keep it.
      if (!archivedAt || archivedAt >= sixMonthsAgo) {
        archivedProjects.push(data);
      }
    });
    
    return archivedProjects;
  } catch (error) {
    console.error('❌ Error fetching archived projects:', error);
    return [];
  }
}
