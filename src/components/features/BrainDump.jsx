import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiTrash2, FiPlus, FiTag, FiArchive, FiTarget, FiCalendar, FiZap } from 'react-feather';
import { useHotkeys } from 'react-hotkeys-hook';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import adhdSupportService from '../../services/adhdSupportService';
import { errorHandler } from '../../utils/errorHandler';

const BrainDump = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [filter, setFilter] = useState('all'); // 'all', 'new', 'processed', 'archived'
  const [searchTerm, setSearchTerm] = useState('');
  
  const inputRef = useRef(null);
  
  // Categories for brain dump items
  const categories = [
    { id: 'idea', label: 'Idea', icon: FiZap, color: 'bg-purple-500' },
    { id: 'task', label: 'Task', icon: FiTarget, color: 'bg-blue-500' },
    { id: 'reminder', label: 'Reminder', icon: FiCalendar, color: 'bg-green-500' },
    { id: 'other', label: 'Other', icon: FiPlus, color: 'bg-gray-500' }
  ];
  
  // Quick actions for processing items
  const quickActions = [
    { id: 'convertToTask', label: 'Convert to Task', icon: FiTarget },
    { id: 'schedule', label: 'Schedule', icon: FiCalendar },
    { id: 'archive', label: 'Archive', icon: FiArchive },
    { id: 'delete', label: 'Delete', icon: FiTrash2 }
  ];
  
  // Load brain dump items
  useEffect(() => {
    loadItems();
  }, []);
  
  // Focus input when modal opens
  useEffect(() => {
    if (isModalOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isModalOpen]);
  
  // Quick access hotkey (Ctrl/Cmd + K)
  useHotkeys('ctrl+k, cmd+k', (e) => {
    e.preventDefault();
    setIsModalOpen(true);
  }, { enableOnFormTags: true });
  
  const loadItems = async () => {
    try {
      const allItems = await DB.getAll('brainDump');
      setItems(allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      errorHandler(error, { component: 'BrainDump/loadItems' });
    }
  };
  
  const addItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    
    try {
      const newItem = await adhdSupportService.addBrainDumpItem(
        newItemText.trim(),
        'general',
        'medium'
      );
      
      setItems(prev => [newItem, ...prev]);
      setNewItemText('');
      
      // Clear selection
      setSelectedItems(new Set());
    } catch (error) {
      errorHandler(error, { component: 'BrainDump/addItem' });
    }
  };
  
  const processSelectedItems = async (action) => {
    const selectedArray = Array.from(selectedItems);
    
    for (const itemId of selectedArray) {
      try {
        await adhdSupportService.processBrainDumpItem(itemId, action, {});
      } catch (error) {
        errorHandler(error, { component: 'BrainDump/processItems', itemId, action });
      }
    }
    
    // Reload items and clear selection
    await loadItems();
    setSelectedItems(new Set());
  };
  
  const deleteItem = async (itemId) => {
    try {
      await adhdSupportService.processBrainDumpItem(itemId, 'delete');
      setItems(prev => prev.filter(item => item.id !== itemId));
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    } catch (error) {
      errorHandler(error, { component: 'BrainDump/deleteItem', itemId });
    }
  };
  
  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };
  
  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };
  
  // Filter items
  const filteredItems = items.filter(item => {
    const matchesFilter = filter === 'all' || item.status === filter;
    const matchesSearch = searchTerm === '' || 
      item.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  
  // Get category info
  const getCategoryInfo = (categoryId) => {
    return categories.find(cat => cat.id === categoryId) || categories[3];
  };
  
  return (
    <>
      {/* Quick Access Button */}
      <motion.button
        onClick={() => setIsModalOpen(true)}
        className="fixed top-20 right-6 z-40 p-3 bg-gray-800 dark:bg-gray-700 text-white rounded-full shadow-lg hover:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Open brain dump (Ctrl+K)"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <FiZap size={20} />
      </motion.button>
      
      {/* Main Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Brain Dump - Capture Your Thoughts"
        size="lg"
      >
        <div className="space-y-4">
          {/* Add New Item */}
          <form onSubmit={addItem} className="space-y-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="Type your thought, idea, or reminder here..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <Button type="submit" disabled={!newItemText.trim()}>
                <FiPlus size={18} />
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Press Ctrl+K anytime to quickly open this. Capture thoughts without losing focus.
            </p>
          </form>
          
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search brain dump..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <div className="flex gap-1">
              {['all', 'new', 'processed', 'archived'].map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filter === filterOption
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => processSelectedItems(action.id)}
                        className="px-2 py-1 text-xs"
                      >
                        <Icon size={14} className="mr-1" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Items List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FiZap className="mx-auto mb-2" size={32} />
                <p>No thoughts captured yet.</p>
                <p className="text-sm">Start typing above to capture your ideas.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredItems.length}
                      onChange={selectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Select all ({filteredItems.length})
                  </label>
                </div>
                
                <AnimatePresence>
                  {filteredItems.map((item, index) => {
                    const category = getCategoryInfo(item.category);
                    const Icon = category.icon;
                    const isSelected = selectedItems.has(item.id);
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        } ${item.status === 'archived' ? 'opacity-50' : ''}`}
                        onClick={() => toggleItemSelection(item.id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItemSelection(item.id)}
                            className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          <div className="flex-1">
                            <p className="text-gray-800 dark:text-gray-200">{item.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${category.color} text-white`}>
                                <Icon size={10} className="mr-1" />
                                {category.label}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                              {item.status !== 'new' && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  • {item.status.replace('-', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItem(item.id);
                            }}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <FiTrash2 size={16} />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BrainDump;
