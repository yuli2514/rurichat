/**
 * personaManager.js
 * 负责用户面具（Persona）的增删改查与UI交互
 */

const PersonaManager = {
    // 打开面具管理模态框
    openModal: function() {
        document.getElementById('user-persona-modal').classList.remove('hidden');
        this.renderList();
    },

    // 关闭面具管理模态框
    closeModal: function() {
        document.getElementById('user-persona-modal').classList.add('hidden');
    },

    // 渲染面具列表
    renderList: function() {
        const list = document.getElementById('user-persona-list');
        const personas = API.Profile.getPersonas();
        
        if (personas.length === 0) {
            list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">暂无面具预设</p>';
            return;
        }

        list.innerHTML = personas.map((p, idx) => 
            '<div class="bg-gray-50 p-3 rounded-lg">' +
                '<div class="flex justify-between items-center mb-1">' +
                    '<span class="font-medium text-sm">' + p.name + '</span>' +
                    '<div class="flex gap-2">' +
                        '<button onclick="PersonaManager.edit(' + idx + ')" class="text-blue-500 text-xs">编辑</button>' +
                        '<button onclick="PersonaManager.delete(' + idx + ')" class="text-red-500 text-xs">删除</button>' +
                    '</div>' +
                '</div>' +
                '<p class="text-xs text-gray-500 line-clamp-2">' + (p.content || '无内容') + '</p>' +
            '</div>'
        ).join('');
    },

    // 创建新面具
    create: function() {
        document.getElementById('edit-persona-index').value = '';
        document.getElementById('edit-persona-name').value = '';
        document.getElementById('edit-persona-content').value = '';
        document.getElementById('user-persona-edit-modal').classList.remove('hidden');
    },

    // 编辑面具
    edit: function(index) {
        const personas = API.Profile.getPersonas();
        const p = personas[index];
        if (!p) return;

        document.getElementById('edit-persona-index').value = index;
        document.getElementById('edit-persona-name').value = p.name;
        document.getElementById('edit-persona-content').value = p.content;
        document.getElementById('user-persona-edit-modal').classList.remove('hidden');
    },

    // 关闭编辑模态框
    closeEditModal: function() {
        document.getElementById('user-persona-edit-modal').classList.add('hidden');
    },

    // 保存编辑后的面具
    save: function() {
        const index = document.getElementById('edit-persona-index').value;
        const name = document.getElementById('edit-persona-name').value.trim();
        const content = document.getElementById('edit-persona-content').value.trim();

        if (!name) return alert('面具名称不能为空');

        let personas = API.Profile.getPersonas();

        if (index === '') {
            personas.push({
                id: 'persona_' + Date.now(),
                name: name,
                content: content,
                timestamp: Date.now()
            });
        } else {
            personas[parseInt(index)].name = name;
            personas[parseInt(index)].content = content;
        }

        API.Profile.savePersonas(personas);
        
        // 如果当前正在使用该面具，更新当前Profile
        // 注意：这里简化处理，直接更新Profile的character字段可能不是必须的，
        // 取决于系统设计。原代码有这行：
        const profile = API.Profile.getProfile();
        profile.character = content;
        API.Profile.saveProfile(profile);
        
        this.closeEditModal();
        this.renderList();
        
        // 通知ChatSettings刷新下拉列表（如果ChatSettings存在）
        if (typeof ChatSettings !== 'undefined' && ChatSettings.loadCharSettings) {
            ChatSettings.loadCharSettings();
        }
    },

    // 删除面具
    delete: function(index) {
        if (!confirm('确定删除此面具？')) return;
        let personas = API.Profile.getPersonas();
        personas.splice(index, 1);
        API.Profile.savePersonas(personas);
        this.renderList();
        
        if (typeof ChatSettings !== 'undefined' && ChatSettings.loadCharSettings) {
            ChatSettings.loadCharSettings();
        }
    }
};
