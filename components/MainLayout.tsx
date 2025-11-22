
import React, { useState, useEffect, Suspense } from 'react';
import { useApp } from '../App';
import { UserRole } from '../types';

// Lazy load components to reduce initial bundle size and fix "chunk larger than 500kB" warning
const Summarizer = React.lazy(() => import('./Summarizer'));
const ExamGenerator = React.lazy(() => import('./ExamGenerator'));
const Chatbot = React.lazy(() => import('./Chatbot'));
const Translator = React.lazy(() => import('./Translator'));
const SlideGenerator = React.lazy(() => import('./SlideGenerator'));
const LearningPath = React.lazy(() => import('./LearningPath'));
const QuestionAnalysis = React.lazy(() => import('./QuestionAnalysis'));
const Library = React.lazy(() => import('./Library'));
const SafetyGuide = React.lazy(() => import('./SafetyGuide'));

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
);

const MainLayout: React.FC = () => {
    const { t, userRole, studentGoal, handleGoHome, logActivity } = useApp();

    const studentFeatures = ['learning_path', 'summarizer', 'exam_generator', 'question_analysis', 'translator', 'library', 'safety_guide'];
    const teacherFeatures = ['ai_assistant', 'exam_generator', 'slide_generator', 'summarizer', 'question_analysis', 'translator', 'library', 'safety_guide'];

    const availableFeatures = userRole === UserRole.STUDENT ? studentFeatures : teacherFeatures;
    
    // Ensure activeTab is valid
    const [activeTab, setActiveTab] = useState(availableFeatures[0]);

    // Track activity when tab changes
    useEffect(() => {
        const tabName = t(activeTab);
        logActivity(tabName, `Viewing ${tabName}`);
    }, [activeTab, t]);

    const renderContent = () => {
        return (
            <Suspense fallback={<LoadingSpinner />}>
                {(() => {
                    switch (activeTab) {
                        case 'summarizer': return <Summarizer />;
                        case 'exam_generator': return <ExamGenerator />;
                        case 'ai_assistant': return <Chatbot />;
                        case 'translator': return <Translator />;
                        case 'slide_generator': return <SlideGenerator />;
                        case 'learning_path': return <LearningPath />;
                        case 'question_analysis': return <QuestionAnalysis />;
                        case 'library': return <Library />;
                        case 'safety_guide': return <SafetyGuide />;
                        default: return null;
                    }
                })()}
            </Suspense>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-transparent text-slate-800 p-4 sm:p-6 lg:p-8 relative z-0">
            <header className="mb-6 flex justify-between items-center relative z-30">
                <div className="flex items-center gap-4">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Trí Việt</h1>
                    <button
                        onClick={handleGoHome}
                        title={t('go_home')}
                        aria-label={t('go_home')}
                        className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </button>
                </div>
                 <div className="text-right text-slate-600 text-sm">
                    <p>{t(userRole)}</p>
                    {userRole === UserRole.STUDENT && <p>{t('select_goal')}: <span className="font-bold text-indigo-600">{t(studentGoal!)}</span></p>}
                </div>
            </header>
            
            <nav className="border-b border-slate-200 mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 relative z-30">
                <div className="flex flex-wrap -mb-px gap-x-1">
                   {availableFeatures.map(tab => {
                        let buttonText = t(tab);
                        if (userRole === UserRole.STUDENT && tab === 'exam_generator') {
                            buttonText = t('review_exercises');
                        }
                        if (tab === 'library') {
                            buttonText = userRole === UserRole.TEACHER ? t('documents') : t('library');
                        }
                        return (
                             <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 cursor-pointer ${
                                    activeTab === tab 
                                    ? 'bg-slate-200/50 text-indigo-600 border-b-2 border-indigo-500' 
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                {buttonText}
                            </button>
                        )
                   })}
                </div>
            </nav>
            
            <main className="flex-grow relative z-10">
                {renderContent()}
            </main>
        </div>
    );
};

export default MainLayout;
