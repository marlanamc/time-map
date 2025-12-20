import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiPlay, FiPause, FiRefreshCw, FiCheck } from 'react-icons/fi';
import { useSound } from 'use-sound';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import adhdSupportService from '../../services/adhdSupportService';
import { errorHandler } from '../../utils/errorHandler';

// Sound effects (you'll need to add these files to your public folder)
const timerStartSound = '/sounds/timer-start.mp3';
const timerEndSound = '/sounds/timer-end.mp3';
const focusBellSound = '/sounds/focus-bell.mp3';

const BodyDouble = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(25 * 60); // 25 minutes in seconds
  const [sessionType, setSessionType] = useState('focus'); // 'focus' or 'break'
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const intervalRef = useRef(null);
  
  // Sound effects
  const [playStart] = useSound(timerStartSound);
  const [playEnd] = useSound(timerEndSound);
  const [playBell] = useSound(focusBellSound);
  
  // Available session durations in minutes
  const focusDurations = [15, 25, 45, 60];
  const breakDurations = [5, 10, 15];
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Start a new session
  const startSession = (duration, type = 'focus') => {
    if (isActive) return;
    
    setSessionType(type);
    setTimeRemaining(duration * 60);
    setIsActive(true);
    playStart();
    
    // Start the countdown
    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          sessionComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Start the body double session in the service
    try {
      adhdSupportService.startBodyDoubleSession(duration, { type: 'solo' });
    } catch (error) {
      errorHandler(error, { component: 'BodyDouble/startSession' });
    }
  };
  
  // Pause the current session
  const pauseSession = () => {
    if (!isActive) return;
    
    clearInterval(intervalRef.current);
    setIsActive(false);
  };
  
  // Reset the timer
  const resetTimer = () => {
    clearInterval(intervalRef.current);
    setIsActive(false);
    setTimeRemaining(25 * 60);
    setSessionType('focus');
  };
  
  // When session completes
  const sessionComplete = () => {
    clearInterval(intervalRef.current);
    setIsActive(false);
    playEnd();
    
    // Add to session history
    const session = {
      id: Date.now(),
      type: sessionType,
      duration: timeRemaining,
      completedAt: new Date().toISOString(),
    };
    
    setSessionHistory(prev => [session, ...prev].slice(0, 10)); // Keep last 10 sessions
    
    // If it was a focus session, suggest a break
    if (sessionType === 'focus') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Auto-start break after 5 seconds
      setTimeout(() => {
        if (!isModalOpen) {
          startSession(5, 'break');
        }
      }, 5000);
    }
    
    // Complete the session in the service
    try {
      adhdSupportService.completeBodyDoubleSession();
    } catch (error) {
      errorHandler(error, { component: 'BodyDouble/sessionComplete' });
    }
  };
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Play focus bell every 5 minutes during focus sessions
  useEffect(() => {
    if (!isActive || sessionType !== 'focus') return;
    
    const bellInterval = setInterval(() => {
      if (timeRemaining > 0) {
        playBell();
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(bellInterval);
  }, [isActive, sessionType, timeRemaining, playBell]);
  
  return (
    <>
      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          aria-label="Open body double timer"
        >
          <FiClock size={24} />
        </button>
      </motion.div>
      
      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 right-6 z-50 p-4 bg-green-500 text-white rounded-lg shadow-lg flex items-center gap-2"
          >
            <FiCheck className="text-white" />
            <span>Great job! Take a short break.</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Body Double Timer"
        size="sm"
      >
        <div className="space-y-6">
          {/* Timer Display */}
          <div className="text-center py-4">
            <div 
              className={`text-6xl font-mono font-bold mb-2 ${
                sessionType === 'focus' ? 'text-indigo-600' : 'text-green-600'
              }`}
            >
              {formatTime(timeRemaining)}
            </div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              {sessionType === 'focus' ? 'Focus Time' : 'Break Time'}
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex justify-center gap-3">
            {!isActive ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => startSession(25, 'focus')}
                  leftIcon={FiPlay}
                >
                  Start Focus
                </Button>
                <Button
                  variant="outline"
                  onClick={resetTimer}
                  disabled={!timeRemaining}
                >
                  <FiRefreshCw size={18} />
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                size="lg"
                onClick={pauseSession}
                leftIcon={FiPause}
              >
                Pause
              </Button>
            )}
          </div>
          
          {/* Quick Start Buttons */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Start Focus
            </h3>
            <div className="flex flex-wrap gap-2">
              {focusDurations.map((mins) => (
                <Button
                  key={`focus-${mins}`}
                  variant="outline"
                  size="sm"
                  onClick={() => startSession(mins, 'focus')}
                  disabled={isActive}
                >
                  {mins} min
                </Button>
              ))}
            </div>
            
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-2">
              Quick Break
            </h3>
            <div className="flex flex-wrap gap-2">
              {breakDurations.map((mins) => (
                <Button
                  key={`break-${mins}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => startSession(mins, 'break')}
                  disabled={isActive}
                >
                  {mins} min
                </Button>
              ))}
            </div>
          </div>
          
          {/* Session History */}
          {sessionHistory.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recent Sessions
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {sessionHistory.map((session) => (
                  <div 
                    key={session.id}
                    className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700/30 rounded-md"
                  >
                    <span className={`font-medium ${
                      session.type === 'focus' ? 'text-indigo-600 dark:text-indigo-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {session.type === 'focus' ? 'Focus' : 'Break'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatTime(session.duration)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default BodyDouble;
