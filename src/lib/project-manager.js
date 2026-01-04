const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ProjectManager {
  constructor(logger, dataDir = './data') {
    this.logger = logger;
    this.projectsPath = path.join(dataDir, 'projects.json');
    this.projects = new Map(); // name -> project
    this.projectIds = new Map(); // id -> project
    this.loadProjects();
  }

  loadProjects() {
    if (fs.existsSync(this.projectsPath)) {
      try {
        const data = fs.readFileSync(this.projectsPath, 'utf8');
        const list = JSON.parse(data);
        list.forEach(p => {
          this.projects.set(p.name, p);
          if (p.id) this.projectIds.set(p.id, p);
        });
      } catch (err) {
        this.logger.error({ err }, 'Failed to load projects');
      }
    }
  }

  saveProjects() {
    const list = Array.from(this.projects.values());
    fs.writeFileSync(this.projectsPath, JSON.stringify(list, null, 2));
  }

  createProject(name) {
    if (this.projects.has(name)) {
      throw new Error('Project name already exists');
    }

    const projectId = crypto.randomUUID();
    const channelId = crypto.randomUUID();

    const project = {
      id: projectId,
      name,
      channelId,
      created: Date.now()
    };

    this.projects.set(name, project);
    this.projectIds.set(projectId, project);
    this.saveProjects();
    
    this.logger.info({ name, projectId }, 'Project created');
    return project;
  }

  getProject(name) {
    return this.projects.get(name);
  }
  
  getProjectById(id) {
    return this.projectIds.get(id);
  }

  getAllProjects() {
    return Array.from(this.projects.values());
  }

  deleteProject(id) {
    const project = this.projectIds.get(id);
    if (!project) return false;

    this.projects.delete(project.name);
    this.projectIds.delete(id);
    this.saveProjects();
    this.logger.info({ id, name: project.name }, 'Project deleted');
    return true;
  }
}

module.exports = ProjectManager;
