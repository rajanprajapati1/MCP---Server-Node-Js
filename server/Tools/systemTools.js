import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// File system tools
export const readFileContent = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return {
      content: [
        {
          type: "text",
          text: content
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error reading file: ${error.message}`
        }
      ]
    };
  }
};

export const listDirectory = async (dirPath) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const formattedItems = items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'directory' : 'file',
      path: path.join(dirPath, item.name)
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(formattedItems, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error listing directory: ${error.message}`
        }
      ]
    };
  }
};

export const writeFileContent = async (filePath, content) => {
  try {
    await fs.writeFile(filePath, content);
    return {
      content: [
        {
          type: "text",
          text: `Successfully wrote to file: ${filePath}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error writing to file: ${error.message}`
        }
      ]
    };
  }
};

export const createDirectory = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return {
      content: [
        {
          type: "text",
          text: `Successfully created directory: ${dirPath}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating directory: ${error.message}`
        }
      ]
    };
  }
};

export const deleteFileOrDirectory = async (path) => {
  try {
    const stats = await fs.stat(path);
    if (stats.isDirectory()) {
      await fs.rm(path, { recursive: true, force: true });
      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted directory: ${path}`
          }
        ]
      };
    } else {
      await fs.unlink(path);
      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted file: ${path}`
          }
        ]
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error deleting item: ${error.message}`
        }
      ]
    };
  }
};

// Application launcher
export const launchApplication = async (appName, platform = process.platform) => {
  try {
    let command;

    if (platform === 'win32') {
      // Windows
      command = `start "" "${appName}"`;
    } else if (platform === 'darwin') {
      // macOS
      command = `open -a "${appName}"`;
    } else {
      // Linux and others
      command = appName;
    }

    const { stdout, stderr } = await execPromise(command);
    return {
      content: [
        {
          type: "text",
          text: `Application launched successfully. Output: ${stdout || 'No output'}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error launching application: ${error.message}`
        }
      ]
    };
  }
};

// File search
export const searchFiles = async (directory, searchTerm) => {
  try {
    async function searchRecursively(dir, term, results = []) {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.name.toLowerCase().includes(term.toLowerCase())) {
          results.push({
            name: item.name,
            path: fullPath,
            type: item.isDirectory() ? 'directory' : 'file'
          });
        }

        if (item.isDirectory()) {
          try {
            await searchRecursively(fullPath, term, results);
          } catch (e) {
            // Skip directories we can't access
          }
        }
      }

      return results;
    }

    const results = await searchRecursively(directory, searchTerm);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error searching files: ${error.message}`
        }
      ]
    };
  }
};

// Get system information
export const getSystemInfo = async () => {
  try {
    const platform = process.platform;
    const architecture = process.arch;
    const nodeVersion = process.version;
    const cpuInfo = await execPromise('node -e "console.log(JSON.stringify(require(\'os\').cpus()))"');
    const memInfo = await execPromise('node -e "console.log(JSON.stringify({total: require(\'os\').totalmem(), free: require(\'os\').freemem()}))"');

    const info = {
      platform,
      architecture,
      nodeVersion,
      cpus: JSON.parse(cpuInfo.stdout),
      memory: JSON.parse(memInfo.stdout)
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(info, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting system info: ${error.message}`
        }
      ]
    };
  }
};