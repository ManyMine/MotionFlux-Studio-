import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBm86AWqYSeR6IHuu-HXFIHC5EXh1DPJa0",
  authDomain: "gen-lang-client-0375005016.firebaseapp.com",
  projectId: "gen-lang-client-0375005016",
  storageBucket: "gen-lang-client-0375005016.firebasestorage.app",
  messagingSenderId: "688332492359",
  appId: "1:688332492359:web:1328a7b7224c24c0afeb62"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-motionfluxstudio-4a9d3695-380a-42a9-a5db-a277337bef5a");
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Erro ao fazer login com o Google:", error);
    if (error?.code === 'auth/unauthorized-domain') {
      const domain = window.location.hostname;
      throw new Error(`Domínio não autorizado. Adicione '${domain}' aos domínios autorizados no Firebase Console (Authentication > Settings > Authorized domains) do projeto 'gen-lang-client-0375005016'.`);
    }
    throw error;
  }
}

export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
    throw error;
  }
}

// Save a single project to cloud Firestore
export async function saveProjectToCloud(email: string, project: any) {
  if (!email || !project || !project.id) return;
  try {
    const docId = `${email.replace(/[^a-zA-Z0-9]/g, '_')}_${project.id}`;
    const docRef = doc(db, 'projects', docId);
    await setDoc(docRef, {
      ...project,
      userId: email,
      updatedAt: project.updatedAt || Date.now()
    }, { merge: true });
    console.log(`Projeto ${project.id} salvo na nuvem.`);
  } catch (err) {
    console.error("Erro ao salvar projeto na nuvem:", err);
  }
}

// Delete a single project from cloud Firestore
export async function deleteProjectFromCloud(email: string, projectId: string) {
  if (!email || !projectId) return;
  try {
    const docId = `${email.replace(/[^a-zA-Z0-9]/g, '_')}_${projectId}`;
    const docRef = doc(db, 'projects', docId);
    await deleteDoc(docRef);
    console.log(`Projeto ${projectId} deletado da nuvem.`);
  } catch (err) {
    console.error("Erro ao deletar projeto na nuvem:", err);
  }
}

// Perform complete two-way synchronization of user projects
export async function syncUserProjectsWithFirestore(email: string) {
  if (!email) return;
  
  // 1. Load local projects
  const localSaved = localStorage.getItem('vid-editor-projects');
  let localProjects: any[] = [];
  if (localSaved) {
    try {
      localProjects = JSON.parse(localSaved);
    } catch (e) {
      console.error("Error reading local projects for sync:", e);
    }
  }

  try {
    // 2. Fetch cloud projects for this email
    const q = query(collection(db, 'projects'), where('userId', '==', email));
    const querySnapshot = await getDocs(q);
    const cloudProjects: any[] = [];
    querySnapshot.forEach((doc) => {
      cloudProjects.push(doc.data());
    });

    console.log(`Sincronização: ${localProjects.length} locais, ${cloudProjects.length} na nuvem para ${email}`);

    // 3. Merge projects (two-way merge based on updatedAt)
    const mergedMap = new Map<string, any>();

    // Start with local projects
    localProjects.forEach((proj) => {
      mergedMap.set(proj.id, proj);
    });

    // Merge cloud projects
    let hasChanges = false;
    cloudProjects.forEach((cloudProj) => {
      const localProj = mergedMap.get(cloudProj.id);
      if (!localProj) {
        // Only in cloud -> import to local
        mergedMap.set(cloudProj.id, cloudProj);
        hasChanges = true;
      } else {
        // In both -> take newer one
        const cloudTime = cloudProj.updatedAt || 0;
        const localTime = localProj.updatedAt || 0;
        if (cloudTime > localTime) {
          mergedMap.set(cloudProj.id, cloudProj);
          hasChanges = true;
        }
      }
    });

    // Clean up internal metadata fields like 'userId' from local objects
    const finalProjectsList = Array.from(mergedMap.values()).map(p => {
      const { userId, ...cleanProj } = p;
      return cleanProj;
    });

    // 4. If local projects list was updated, save back to local storage
    if (hasChanges || finalProjectsList.length !== localProjects.length) {
      localStorage.setItem('vid-editor-projects', JSON.stringify(finalProjectsList));
      // Trigger update event
      window.dispatchEvent(new Event('storage'));
    }

    // 5. Upload any newer or missing local projects to the cloud
    for (const finalProj of finalProjectsList) {
      const cloudProj = cloudProjects.find(cp => cp.id === finalProj.id);
      const localTime = finalProj.updatedAt || 0;
      const cloudTime = cloudProj ? (cloudProj.updatedAt || 0) : 0;

      if (!cloudProj || localTime > cloudTime) {
        const docId = `${email.replace(/[^a-zA-Z0-9]/g, '_')}_${finalProj.id}`;
        const docRef = doc(db, 'projects', docId);
        await setDoc(docRef, {
          ...finalProj,
          userId: email,
          updatedAt: localTime || Date.now()
        }, { merge: true });
      }
    }

    console.log("Sincronização de projetos concluída!");
  } catch (error) {
    console.error("Erro na sincronização de projetos com Firestore:", error);
  }
}
