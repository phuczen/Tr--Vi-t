import React, { useState, useEffect, useRef } from 'react';
import { Part, Type } from '@google/genai';
import { useApp } from '../App';
import MarkdownRenderer from './MarkdownRenderer';
import { LibraryItemType, UserRole } from '../types';
import { ai } from '../api';

// Make sure KaTeX is available on the window object
declare global {
    interface Window {
        katex: any;
    }
}

const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        return; // Success, exit
    } catch (err) {
        // This can happen if the document is not focused. Proceed to fallback.
    }

    // Fallback method using execCommand
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (!successful) {
            throw new Error('Fallback: Unable to copy content.');
        }
    } catch (err) {
        throw new Error(`Fallback: Copying failed with error: ${err}`);
    } finally {
        document.body.removeChild(textArea);
    }
};

const QuestionAnalysis: React.FC = () => {
    const { t, language, userRole, addToLibrary, handleViolation } = useApp();
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState('');
    const [markdownContent, setMarkdownContent] = useState('');
    const [wordContent, setWordContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copyAsTextButtonText, setCopyAsTextButtonText] = useState(t('copy_as_text'));
    const [copyForWordButtonText, setCopyForWordButtonText] = useState(t('copy_for_word'));
    const [saveButtonText, setSaveButtonText] = useState(t(userRole === UserRole.TEACHER ? 'save_to_documents' : 'save_to_library'));
    const fileInputRef = useRef<HTMLInputElement>(null);


    const resetSaveButton = () => {
        setSaveButtonText(t(userRole === UserRole.TEACHER ? 'save_to_documents' : 'save_to_library'));
    }

    useEffect(() => {
        setCopyAsTextButtonText(t('copy_as_text'));
        setCopyForWordButtonText(t('copy_for_word'));
        resetSaveButton();
    }, [markdownContent, t, userRole]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setFileName(selectedFile.name);
            setMarkdownContent(''); // Clear previous results on new file selection
            setWordContent('');
            setError(null);
            resetSaveButton();
        }
    };

    const handleGenerate = async () => {
        if (!file) return;
        setIsLoading(true);
        setMarkdownContent('');
        setWordContent('');
        setError(null);
        resetSaveButton();

        try {
            const fileToGenerativePart = async (file: File): Promise<Part> => {
                const base64EncodedDataPromise = new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(file);
                });
                return {
                    inlineData: {
                        data: await base64EncodedDataPromise,
                        mimeType: file.type,
                    },
                };
            };
            
            const uploadedFilePart = await fileToGenerativePart(file);
            
            const prompt = `
                Act as an expert teacher who speaks **${language}**. I have provided a file containing a question. Your task is to guide the student to understand it, NOT just give the answer.
                
                **Input Context:** The filename is "${file.name}".
                
                **SAFETY CHECK:**
                If the file/question asks to generate passwords or credentials, this is a violation. Return {"markdownContent": "VIOLATION_DETECTED", "wordContent": "VIOLATION_DETECTED"}.

                **PEDAGOGICAL RULES:**
                1.  **Analyze**: Explain the core concept behind the question.
                2.  **Guide**: Outline the steps to solve it, but challenge the student to do the calculation or reasoning.
                3.  **Expand**: Provide similar exercises for practice.
                4.  **Curriculum**: Strictly follow the **Vietnam Ministry of Education 2018 General Education Program**.
                5.  **Language**: Respond in **${language}**.
                
                **LaTeX Formatting**: ALL mathematical content MUST be enclosed in LaTeX delimiters. \`$...$\` for inline and \`$$...$$\` for block.

                **CRITICAL OUTPUT FORMAT:**
                Your entire response MUST be a single, valid JSON object.
                This object MUST have two keys:
                1.  \`markdownContent\`: The full response formatted with Markdown and LaTeX for web display in ${language}.
                2.  \`wordContent\`: The same response, but with LaTeX converted to Microsoft Word's native Equation format (UnicodeMath) for direct copy-pasting.
                
                **RESPONSE STRUCTURE (for both contents):**

                **PART 1: ${t('analysis_of_original_question')}**
                -   Start with the Markdown heading: \`## ${t('analysis_of_original_question')}\`.
                -   Explain the core concept.
                -   Provide a step-by-step guide (hinting at the solution).
                -   State the difficulty level.

                **PART 2: ${t('similar_practice_exercises')}**
                -   Start with the Markdown heading: \`## ${t('similar_practice_exercises')}\`.
                -   Generate 3 to 5 new questions that test the exact same concepts.
            `;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    markdownContent: { type: Type.STRING, description: `Content with Markdown and LaTeX in ${language}.` },
                    wordContent: { type: Type.STRING, description: `Content with UnicodeMath for MS Word in ${language}.` }
                },
                required: ['markdownContent', 'wordContent']
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Using pro for better image analysis and reasoning
                contents: { parts: [uploadedFilePart, { text: prompt }] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema
                }
            });

            const result = JSON.parse(response.text || '{}');
            
            if (result.markdownContent === 'VIOLATION_DETECTED') {
                handleViolation('severe');
                return;
            }

            // Append ethics reminder
            const finalMarkdown = (result.markdownContent || '') + t('ethics_reminder');
            const finalWordContent = (result.wordContent || '') + t('ethics_reminder');

            setMarkdownContent(finalMarkdown);
            setWordContent(finalWordContent);

        } catch (e: any) {
            console.error("Error generating exercises:", e);
            let errorMsg = "Sorry, an error occurred while generating the exercises. The uploaded file might be unsupported or an API error occurred. Please try again.";
            if (e.message?.includes('safety') || e.message?.includes('blocked') || e.toString().includes('SAFETY')) {
                errorMsg = t('unsafe_content_error');
                handleViolation('mild');
            }
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!markdownContent.trim() || !fileName.trim()) return;
        addToLibrary({
            name: `${t('similar_exercises')}: ${fileName}`,
            type: LibraryItemType.SIMILAR_EXERCISES,
            content: markdownContent,
        });
        setSaveButtonText(t('saved'));
        setTimeout(() => resetSaveButton(), 2000);
    };

    const handleCopyAsText = () => {
        if (!markdownContent) return;

        const plainText = markdownContent
            .replace(/## /g, '\n')
            .replace(/### /g, '')
            .replace(/\$\$(.*?)\$\$/g, '$1')
            .replace(/\$(.*?)\$/g, '$1')
            .replace(/- /g, '- ')
            .trim();
            
        copyToClipboard(plainText)
            .then(() => {
                setCopyAsTextButtonText(t('copied'));
                setTimeout(() => setCopyAsTextButtonText(t('copy_as_text')), 2000);
            })
            .catch(err => {
                console.error('Failed to copy text:', err);
                alert('Could not copy text.');
            });
    };

    const handleCopyToWord = () => {
        if (!wordContent) return;
        copyToClipboard(wordContent)
            .then(() => {
                setCopyForWordButtonText(t('copied'));
                setTimeout(() => setCopyForWordButtonText(t('copy_for_word')), 2000);
            })
            .catch(err => {
                console.error('Failed to copy text for Word:', err);
                alert('Failed to copy content for Word.');
            });
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Section */}
            <div className="lg:col-span-1 bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm p-6 rounded-2xl">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">{t('question_analysis_title')}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('upload_question_file')}</label>
                        <div className="flex items-center gap-3">
                             <input 
                                ref={fileInputRef}
                                type="file" 
                                onChange={handleFileChange} 
                                accept="image/*,.pdf" 
                                className="hidden"
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
                            >
                                {t('choose_file')}
                            </button>
                            <span className="text-sm text-slate-500 truncate flex-1">
                                {fileName || t('no_file_chosen')}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleGenerate} disabled={isLoading || !file} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-300 transform hover:scale-105">
                        {isLoading ? t('generating') : t('generate_similar_exercises')}
                    </button>
                    <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
                        {markdownContent && !isLoading && (
                            <>
                                <div className="w-full flex gap-2">
                                    <button 
                                        onClick={handleCopyAsText} 
                                        className="flex-1 text-sm bg-slate-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 transform hover:scale-105">
                                        {copyAsTextButtonText}
                                    </button>
                                    <button 
                                        onClick={handleCopyToWord} 
                                        className="flex-1 text-sm bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-all duration-300 transform hover:scale-105">
                                        {copyForWordButtonText}
                                    </button>
                                </div>
                                <button 
                                    onClick={handleSave} 
                                    className="w-full sm:w-auto bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-bold py-3 px-4 rounded-lg hover:from-sky-700 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105">
                                    {saveButtonText}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* Output Section */}
            <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm p-2 rounded-2xl min-h-[600px]">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-600 p-4 text-center">{error}</div>
                ) : (
                     <div className="h-full overflow-y-auto bg-white rounded-lg custom-scrollbar">
                        <MarkdownRenderer markdown={markdownContent} placeholder={t('similar_exercises_placeholder')} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionAnalysis;