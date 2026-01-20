import type { SortlyItem } from '../types/sortly';
import { sortlyClient } from '../lib/sortly';

interface FolderTree {
  id: number;
  name: string;
  type?: string;
  parent_id?: number | null;
  children?: FolderTree[];
}

// Fetch all folders from Sortly and print a structured tree to the console
export async function fetchAllFolders() {
  const allItems: SortlyItem[] = [];
  let page = 1;
  let hasMore = true;

  console.log('Fetching all Sortly folders...');

  while (hasMore) {
    // Fetch items page by page
    const response = await sortlyClient.listItems({ per_page: 100, page });
    
    // Append fetched items to allItems
    if (response.data && response.data.length > 0) {
      allItems.push(...response.data);
      page++;
      
      // Check if there are more pages
      hasMore = response.data.length === 100;
    } else {
      hasMore = false;
    }
  }

  // Filter only folders
  const folders = allItems.filter(item => item.type === 'folder');

  console.log(`\nFound ${folders.length} folders total\n`);
  console.log('='.repeat(80));
  
  // Build folder tree
  const folderMap = new Map<number, FolderTree>();
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      id: folder.id,
      name: folder.name,
      type: folder.type,
      parent_id: folder.parent_id,
      children: []
    });
  });

  // Organize into tree
  const rootFolders: FolderTree[] = [];
  folderMap.forEach(folder => {
    if (folder.parent_id === null || folder.parent_id === undefined) {
      rootFolders.push(folder);
    } else {
      const parent = folderMap.get(folder.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(folder);
      }
    }
  });

  // Print tree
  function printTree(folders: FolderTree[], indent = 0) {
    folders.forEach(folder => {
      console.log(`${'  '.repeat(indent)}📁 ${folder.name} (ID: ${folder.id})`);
      if (folder.children && folder.children.length > 0) {
        printTree(folder.children, indent + 1);
      }
    });
  }

  printTree(rootFolders);
  console.log('='.repeat(80));

  // Find project folders specifically
  console.log('\n🎯 PROJECT FOLDERS:\n');
  
  const projectsFolder = rootFolders.find(f => f.name === 'Projects');
  if (projectsFolder && projectsFolder.children) {
    projectsFolder.children.forEach(project => {
      console.log(`\n${project.name} (ID: ${project.id})`);
      if (project.children) {
        project.children.forEach(subfolder => {
          console.log(`  └─ ${subfolder.name} (ID: ${subfolder.id})`);
        });
      }
    });
  }

  return folders;
}