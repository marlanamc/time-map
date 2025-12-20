import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMaximize, FiMinimize, FiTarget, FiClock, FiPause, FiPlay, FiX } from 'react-icons/fi';
import { useHotkeys } from 'react-hotkeys-hook';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import adhdSupportService from '../../services/adhdSupportService';
import { errorHandler } from '../../utils/errorHandler';

const FocusMode = ({ children }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [settings, setSettings] = useState({
    hideNavigation: true,
    dimBackground: true,
    focusDuration: 25, // minutes
    showTimer: true,
    typewriterEffect: false,
    fontSize: 'md',
    theme: 'dark',
  });
  
  const timerRef = useRef(null);
  const focusAreaRef = useRef(null);
  
  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        errorHandler(new Error(`Error attempting to enable fullscreen: ${err.message}`), { component: 'FocusMode' });
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }, []);
  
  // Handle keyboard shortcuts
  useHotkeys('esc', () => {
    if (isFullscreen) toggleFullscreen();
    if (isActive) setIsActive(false);
  }, [isFullscreen, isActive, toggleFullscreen]);
  
  useHotkeys('f11', (e) => {
    e.preventDefault();
    toggleFullscreen();
  }, [toggleFullscreen]);
  
  // Timer effect
  useEffect(() => {
    if (isActive) {
      const startTime = Date.now() - timeElapsed * 1000;
      
      timerRef.current = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      // Start focus session
      adhdSupportService.startFocusSession('focus-mode', { type: 'focus' });
      
      return () => {
        clearInterval(timerRef.current);
        
        // End focus session if active
        if (isActive) {
          adhdSupportService.endFocusSession('focus-mode', { notes: 'Focus mode session completed' });
        }
      };
    }
  }, [isActive]);
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Toggle focus mode
  const toggleFocusMode = () => {
    if (!isActive) {
      setTimeElapsed(0);
      setIsActive(true);
      if (!isFullscreen) toggleFullscreen();
    } else {
      setIsActive(false);
      clearInterval(timerRef.current);
      
      // Show completion message
      const minutesFocused = Math.floor(timeElapsed / 60);
      if (minutesFocused >= 1) {
        // Trigger celebration for productive session
        adhdSupportService.triggerCelebration('focusSessionComplete', {
          duration: minutesFocused,
          distractions: 0
        });
      }
    }
  };
  
  // Get focus mode styles based on settings
  const getFocusStyles = () => {
    const baseStyles = {
      container: 'fixed inset-0 z-50 bg-opacity-90 transition-all duration-300',
      content: 'max-w-4xl mx-auto p-6 h-full flex flex-col',
    };
    
    if (settings.theme === 'dark') {
      baseStyles.container += ' bg-gray-900 text-gray-100';
    } else {
      baseStyles.container += ' bg-white text-gray-900';
    }
    
    if (settings.dimBackground) {
      baseStyles.container += ' backdrop-blur-sm';
    }
    
    return baseStyles;
  };
  
  const styles = getFocusStyles();
  
  // Render focus mode overlay
  if (isActive) {
    return (
      <div className={styles.container} ref={focusAreaRef}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <FiTarget className="text-indigo-400" />
            <h2 className="text-xl font-semibold">Focus Mode</h2>
            {settings.showTimer && (
              <div className="flex items-center text-lg font-mono">
                <FiClock className="mr-2 text-indigo-400" />
                {formatTime(timeElapsed)}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFocusMode}
              className="flex items-center gap-1"
            >
              {isActive ? (
                <>
                  <FiPause size={16} />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <FiPlay size={16} />
                  <span>Resume</span>
                </>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="hidden md:flex items-center gap-1"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <FiMinimize size={16} /> : <FiMaximize size={16} />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="hidden md:flex items-center gap-1"
              aria-label="Settings"
            >
              ⚙️
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsActive(false);
                if (isFullscreen) toggleFullscreen();
              }}
              className="text-red-400 hover:bg-red-900/20"
              aria-label="Exit focus mode"
            >
              <FiX size={20} />
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className={styles.content}>
          <div className="flex-1 overflow-auto p-4">
            {React.cloneElement(children, { isFocusMode: true })}
          </div>
        </div>
        
        {/* Settings Modal */}
        <Modal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          title="Focus Mode Settings"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Show Timer</span>
                <input
                  type="checkbox"
                  checked={settings.showTimer}
                  onChange={(e) => setSettings(s => ({ ...s, showTimer: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
            
            <div>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Dim Background</span>
                <input
                  type="checkbox"
                  checked={settings.dimBackground}
                  onChange={(e) => setSettings(s => ({ ...s, dimBackground: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Theme</label>
              <div className="flex space-x-2">
                {['light', 'dark', 'sepia'].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setSettings(s => ({ ...s, theme }))}
                    className={`px-3 py-1.5 text-sm rounded ${
                      settings.theme === theme
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Font Size</label>
              <div className="flex space-x-2">
                {['sm', 'md', 'lg', 'xl'].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSettings(s => ({ ...s, fontSize: size }))}
                    className={`px-3 py-1.5 text-sm rounded ${
                      settings.fontSize === size
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
  
  // Render children normally when not in focus mode
  return (
    <>
      {children}
      
      {/* Floating action button to activate focus mode */}
      <motion.div
        className="fixed bottom-6 left-6 z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={toggleFocusMode}
          variant="primary"
          size="lg"
          className="shadow-lg rounded-full px-4 py-3"
          leftIcon={FiTarget}
        >
          Focus Mode
        </Button>
      </motion.div>
    </>
  );
};

export default FocusMode;
