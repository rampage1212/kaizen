"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

// Create a reusable axios instance with configuration
const apiClient = axios.create({
  baseURL: "https://api.dify.ai/v1",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer app-8ez6bxvFsMaZAEalZbsfD9Jl",
  },
});

// Message type definition
const MessageType = {
  USER: "user",
  BOT: "assistant",
  SYSTEM: "system",
};

// Function to detect image URLs in text
const detectImageUrls = (text) => {
  // Improved regex to handle URLs with query parameters and parentheses
  const imageRegex =
    /(https?:\/\/[^\s()<>]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:[^\s()<>]*)?)/gi;

  // Find all potential matches
  const matches = [];
  let match;
  while ((match = imageRegex.exec(text)) !== null) {
    // Handle URLs that might end with parentheses
    let url = match[1];

    // Check for unbalanced closing parenthesis at the end that might not be part of the URL
    const openParens = (url.match(/\(/g) || []).length;
    const closeParens = (url.match(/\)/g) || []).length;

    if (closeParens > openParens && url.endsWith(")")) {
      url = url.slice(0, -1); // Remove the last parenthesis
    }

    matches.push(url);
  }

  return matches;
};

// Function to check if a URL is likely an image
const isImageUrl = (url) => {
  const imageExtensions = /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i;
  return imageExtensions.test(url);
};

const parseMessage = (message) => {
  // Regex to match **text** for bold
  const boldRegex = /\*\*(.*?)\*\*/g;

  // Split the message using the regex and map to React elements
  const parts = message.split(boldRegex).map((part, index) => {
    if (index % 2 === 1) {
      return (
        <span key={index} className="font-bold">
          {part}
        </span>
      ); // Bold text
    }
    return part; // Normal text
  });

  return parts;
};

// Component to render message content with images
const MessageContent = ({ content }) => {
  // Extract image URLs from the content
  const imageUrls = detectImageUrls(content);

  if (imageUrls.length === 0) {
    // If no images, just return the text content
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }

  // Process the content to replace image URLs with image components
  let processedContent = content;
  const contentParts = [];

  // Split content by image URLs and create array of text and image elements
  let lastIndex = 0;

  imageUrls.forEach((imageUrl, index) => {
    const startIndex = processedContent.indexOf(imageUrl, lastIndex);
    if (startIndex > lastIndex) {
      // Add text before the image
      contentParts.push(
        <p key={`text-${index}`} className="whitespace-pre-wrap break-words">
          {processedContent.substring(lastIndex, startIndex)}
        </p>
      );
    }

    // Add the image
    contentParts.push(
      <div key={`img-${index}`} className="my-2 max-w-full">
        <img
          src={imageUrl}
          alt="Shared image"
          className="rounded-lg max-h-60 object-contain"
          onError={(e) => {
            // If image fails to load, replace with link
            e.target.outerHTML = `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline">${imageUrl}</a>`;
          }}
        />
      </div>
    );

    lastIndex = startIndex + imageUrl.length;
  });

  // Add any remaining text after the last image
  if (lastIndex < processedContent.length) {
    contentParts.push(
      <p key="text-last" className="whitespace-pre-wrap break-words">
        {parseMessage(processedContent.substring(lastIndex))}
      </p>
    );
  }

  return <>{contentParts}</>;
};

const ChatComponent = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: MessageType.SYSTEM,
      content: "Welcome! How can I assist you today?",
      timestamp: new Date(),
    },
    {
      id: 2,
      type: MessageType.BOT,
      content: "I'm your AI assistant. Feel free to ask me anything!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Focus input on component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll to the bottom when new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (input.trim() === "") return;

    const userMessage = {
      id: Date.now(),
      type: MessageType.USER,
      content: input,
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsTyping(true);
    setError(null);

    try {
      const response = await apiClient.post("/chat-messages", {
        inputs: { category: "refrigerator" },
        query: input,
        conversation_id: conversationId,
        user: "abc-123",
      });

      // Save conversation ID if it's the first message
      if (!conversationId && response.data.conversation_id) {
        setConversationId(response.data.conversation_id);
      }

      const botMessage = {
        id: Date.now() + 1,
        type: MessageType.BOT,
        content: response.data.answer,
        timestamp: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error("Error fetching response:", error);
      setError("Failed to get response. Please try again.");

      // Add error message to chat
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: Date.now() + 1,
          type: MessageType.SYSTEM,
          content: "Sorry, I couldn't process your request. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      // Focus back on input after response
      inputRef.current?.focus();
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Submit on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[800px] w-full mx-auto rounded-xl shadow-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Assistant</h1>
            <p className="text-sm text-blue-100">Online | Ready to help</p>
          </div>
        </div>
      </div>

      {/* Chat messages container */}
      <div
        ref={chatContainerRef}
        className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-800 space-y-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.type === MessageType.USER
                ? "justify-end"
                : "justify-start"
            } ${message.type === MessageType.SYSTEM ? "justify-center" : ""}`}
          >
            {message.type === MessageType.SYSTEM ? (
              <div className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm max-w-[85%]">
                {message.content}
              </div>
            ) : (
              <div className="flex items-end space-x-2 max-w-[85%]">
                {message.type === MessageType.BOT && (
                  <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex-shrink-0 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-300"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                    </svg>
                  </div>
                )}

                <div className="flex flex-col">
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.type === MessageType.USER
                        ? "bg-blue-500 text-white rounded-br-none"
                        : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm"
                    }`}
                  >
                    <MessageContent content={message.content} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 self-end">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>

                {message.type === MessageType.USER && (
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-blue-600 dark:text-blue-300"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-end space-x-2">
              <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex-shrink-0 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-indigo-600 dark:text-indigo-300"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
              </div>

              <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700"
      >
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 p-3 pl-4 pr-16 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <div className="absolute right-2 flex space-x-1">
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
          Press Ctrl+Enter to send •{" "}
          {conversationId ? "Conversation active" : "New conversation"}
        </div>
      </form>
    </div>
  );
};

export default ChatComponent;
