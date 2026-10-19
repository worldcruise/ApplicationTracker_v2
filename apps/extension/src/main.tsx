import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@candidate/ui/styles.css';
import './workspace.css';
import {App} from './workspace';
const root=document.getElementById('root');if(!root)throw Error('Workspace root missing.');
createRoot(root).render(<StrictMode><App/></StrictMode>);
