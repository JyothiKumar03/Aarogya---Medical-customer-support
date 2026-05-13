Coding Assessment: AI-Powered Customer Support System 
Health Insurance Company Customer Interaction Platform 
Background 
You are building a customer support system for a health insurance company. The goal is to reduce human agent load by deflecting common queries through an intelligent AI interface and only escalating to ticketed support when necessary. 
What You Need to Build 
A end-to-end customer support platform with the following layers: 
1. Chat Interface A clean, conversational UI (think ChatGPT/Claude style) where end customers can type their queries and receive natural language responses. 
2. Knowledge Base Q&A Behind the chat is a knowledge base (can be static JSON/markdown files, a vector DB, or any structure you prefer). The system should answer questions grounded in this KB first. 
3. Web Fallback (Guardrailed) If the answer is not found in the KB, the system should optionally search the web but with guardrails. It should only surface information relevant to health insurance and clearly indicate it came from a web source, not the company's own KB. 
4. Ticket Creation If the customer is still unsatisfied after AI responses (they can signal this via a button or message), the system should create a support ticket. You can use any open-source ticketing tool (e.g., Plane, Zammad, Linear trial, a simple DB your call) or build a lightweight custom one. 
5. Ticket Resolution → KB Feedback Loop (Bonus) When a ticket is resolved, its resolution summary should optionally flow back into the knowledge base so future similar queries get deflected automatically. 
Constraints & Freedom
Area Constraint 
LLM Use Claude API (Anthropic) 
UI Any framework React, vanilla HTML, Streamlit, etc. 
KB format Your choice markdown, JSON, vector DB, plain text 
Ticketing Your choice open source, trial SaaS, or custom 
Language Any 
Time 3–4 hours of focused building 
Evaluation Criteria 
Dimension What We're Looking For 
Working Demo Does it actually run end-to-end? 
AI Quality Are responses grounded, relevant, and not 
hallucinated? 
UX Is the chat interface intuitive and clean? 
Fallback Logic Is the KB → Web → Ticket escalation path logical? 
Code Quality Is it readable, modular, and not spaghetti? 
Bonus Did they attempt the KB feedback loop? 
Sample Data 
Use the following as your sample knowledge base entries to keep health insurance domain realistic: 
● "What is my deductible?" → "Your annual deductible is the amount you pay before your insurance kicks in. Refer to your policy document Section 3 for your specific amount." 
● "How do I file a claim?" → "Log into the member portal, go to Claims > Submit New Claim, and upload your hospital bill and discharge summary." 
● "Is physiotherapy covered?" → "Physiotherapy is covered up to 20 sessions per year under the Wellness add-on plan. Check if your plan includes this add-on." ● "What is the cashless hospitalisation process?" → "Present your insurance card at any network hospital. The hospital will coordinate directly with us for pre-authorisation." 
You may add more entries or restructure the KB however you like.
Deliverable 
● A GitHub repo with a README that includes setup instructions and a short explanation of your architectural decisions 
● A short Loom / screen recording (3–5 min) walking through the working system ● A working URL of the system with both consumer facing and admin facing systems ● Document any known limitations or shortcuts you took given time constraints honesty is valued 
Bonus Points 
● Make this as comprehensive and production ready as you can with good UX ● Show the ticket resolution → KB loop working (even if mocked) 
● Add a confidence score or source label on responses ("Answered from KB" vs "Answered from Web") 
● Dockerise the setup
