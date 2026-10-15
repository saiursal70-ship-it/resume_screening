import re
from typing import Any, Dict, List

from app.ai.interface import AIInterface

STOPWORDS = {
    "with", "have", "must", "need", "years", "year", "experience", "proven",
    "strong", "ability", "proficient", "proficiency", "knowledge", "working",
    "understanding", "skills", "good", "excellent", "required", "nice", "plus"
}


class FakeAI(AIInterface):
    """Deterministic, mock AI implementation for tests and offline development."""

    def __init__(self, model_id: str = "fake-ai-v1", prompt_version: str = "v1.0"):
        self.model_id = model_id
        self.prompt_version = prompt_version

    async def extract_requirements(self, job_description: str) -> List[Dict[str, Any]]:
        lines = [line.strip() for line in job_description.splitlines() if line.strip()]
        requirements = []

        for line in lines:
            # Clean bullet points
            cleaned = re.sub(r"^[\*\-•\d\.\)]+\s*", "", line).strip()
            if len(cleaned) < 10:
                continue

            lower = cleaned.lower()
            is_must_have = any(
                keyword in lower
                for keyword in ["must", "required", "essential", "minimum", "need", "at least"]
            )

            requirements.append({
                "text": cleaned,
                "category": "must_have" if is_must_have else "nice_to_have",
                "weight": 2.0 if is_must_have else 1.0,
            })

        if not requirements:
            # Fallback requirements if no lines matched
            requirements = [
                {"text": "Relevant professional software experience", "category": "must_have", "weight": 2.0},
                {"text": "Proficiency in modern programming languages", "category": "nice_to_have", "weight": 1.0},
            ]

        return requirements

    async def extract_profile(self, resume_text: str) -> Dict[str, Any]:
        # Extract email
        email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", resume_text)
        email = email_match.group(0) if email_match else "john.doe@example.com"

        # Extract phone
        phone_match = re.search(
            r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}",
            resume_text,
        )
        phone = phone_match.group(0) if phone_match else "+1-555-0100"

        # Extract name: first non-empty line or look for Name:
        name = "John Doe"
        name_prefix_match = re.search(r"(?:name|candidate):\s*([^\n\r]+)", resume_text, re.IGNORECASE)
        if name_prefix_match:
            name = name_prefix_match.group(1).strip()
        else:
            lines = [l.strip() for l in resume_text.splitlines() if l.strip()]
            for line in lines:
                # If first line looks like a name (2-4 words, short, no numbers)
                words = line.split()
                if 1 <= len(words) <= 4 and len(line) < 40 and not any(char.isdigit() for char in line):
                    name = line
                    break

        # Extract address
        address = "123 Main St, Springfield"
        address_prefix_match = re.search(r"(?:address|location):\s*([^\n\r]+)", resume_text, re.IGNORECASE)
        if address_prefix_match:
            address = address_prefix_match.group(1).strip()

        # Extract skills
        common_skills = [
            "Python", "FastAPI", "Django", "Flask", "PostgreSQL", "SQL", "MySQL",
            "JavaScript", "TypeScript", "React", "Vue", "Node.js", "Docker",
            "Kubernetes", "AWS", "GCP", "Git", "CI/CD", "REST", "GraphQL"
        ]
        found_skills = [
            skill for skill in common_skills
            if re.search(rf"\b{re.escape(skill)}\b", resume_text, re.IGNORECASE)
        ]

        # Extract experience sentences
        exp_lines = [
            line.strip()
            for line in resume_text.splitlines()
            if any(term in line.lower() for term in ["engineer", "developer", "experience", "lead", "architect"])
        ]

        # Extract education
        edu_lines = [
            line.strip()
            for line in resume_text.splitlines()
            if any(term in line.lower() for term in ["university", "college", "bachelor", "master", "phd", "degree", "b.s.", "m.s."])
        ]

        return {
            "name": name,
            "email": email,
            "phone": phone,
            "address": address,
            "skills": found_skills or ["Software Engineering"],
            "experience": exp_lines[:5],
            "education": edu_lines[:3] or ["Bachelor of Science in Computer Science"],
        }

    async def score_resume(
        self, redacted_text: str, requirements: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        verdicts = []
        sentences = [s.strip() for s in re.split(r"[\n\.\;]", redacted_text) if s.strip()]

        for req in requirements:
            req_text = req.get("text", "")
            # Tokenize requirement into meaningful search words
            words = [
                w.lower()
                for w in re.findall(r"\b[a-zA-Z0-9\+\#]{2,}\b", req_text)
                if w.lower() not in STOPWORDS
            ]

            matching_sentence = ""
            matched_words = []

            for s in sentences:
                s_lower = s.lower()
                hits = [w for w in words if w in s_lower]
                if len(hits) > len(matched_words):
                    matched_words = hits
                    matching_sentence = s

            if len(matched_words) >= 2 or (len(words) == 1 and len(matched_words) == 1):
                verdicts.append({
                    "requirement_text": req_text,
                    "verdict": "met",
                    "quote": matching_sentence,
                    "reasoning": f"Candidate demonstrates requirement through: '{matching_sentence}'",
                })
            elif len(matched_words) == 1:
                verdicts.append({
                    "requirement_text": req_text,
                    "verdict": "partial",
                    "quote": matching_sentence,
                    "reasoning": f"Partial match found in resume: '{matching_sentence}'",
                })
            else:
                verdicts.append({
                    "requirement_text": req_text,
                    "verdict": "not_met",
                    "quote": "",
                    "reasoning": f"Requirement '{req_text}' is not mentioned in resume.",
                })

        return {"verdicts": verdicts}

    async def generate_job_description(
        self,
        job_title: str,
        seniority: str | None = None,
        key_skills: str | None = None,
    ) -> str:
        title_lower = job_title.lower()
        level = seniority or ("Senior" if "senior" in title_lower else ("Lead" if "lead" in title_lower else ("Junior" if "junior" in title_lower else "Mid-Level")))
        
        # Domain detection
        if any(w in title_lower for w in ["python", "fastapi", "django", "backend"]):
            domain = "Backend Engineering"
            primary_tech = "Python, FastAPI, PostgreSQL, and modern microservice architectures"
            resp = [
                "Architect, develop, and maintain performant, scalable RESTful APIs and backend services.",
                "Design and optimize relational databases (PostgreSQL), data models, and caching strategies.",
                "Collaborate with frontend engineers and product teams to define technical requirements.",
                "Write robust unit and integration tests to ensure exceptional code reliability.",
                "Participate in code reviews, technical architecture sessions, and sprint planning.",
            ]
            must_haves = [
                f"{'5+' if level == 'Senior' else '3+'} years of production software development experience in Python.",
                "Demonstrated proficiency with modern Python web frameworks such as FastAPI, Django, or Flask.",
                "Strong database experience with PostgreSQL or similar relational database systems.",
                "Familiarity with containerization using Docker and CI/CD automation pipelines.",
            ]
            nice_haves = [
                "Experience with async Python (asyncio, asyncpg, aiohttp).",
                "Familiarity with cloud platforms (GCP, AWS) and container orchestration (Kubernetes).",
                "Exposure to Redis caching or message queues (RabbitMQ, Kafka).",
            ]
        elif any(w in title_lower for w in ["react", "frontend", "front-end", "vue", "angular", "ui"]):
            domain = "Frontend Engineering"
            primary_tech = "React, TypeScript, Next.js/Vite, and Tailwind CSS"
            resp = [
                "Build responsive, high-performance web applications with modern React and TypeScript.",
                "Transform complex Figma designs and product specs into modular, accessible UI components.",
                "Collaborate closely with backend engineers to integrate REST and GraphQL endpoints.",
                "Optimize client-side performance, state management, and asset delivery.",
                "Maintain code quality through linting, automated testing, and comprehensive code reviews.",
            ]
            must_haves = [
                f"{'5+' if level == 'Senior' else '3+'} years of experience building modern web applications.",
                "Deep proficiency in React, TypeScript, and modern JavaScript (ES6+).",
                "Strong grasp of responsive styling frameworks (Tailwind CSS, CSS Modules).",
                "Experience working with RESTful APIs, async state management, and browser APIs.",
            ]
            nice_haves = [
                "Experience with Vite, Next.js, or modern build tools.",
                "Knowledge of web accessibility (WCAG 2.1) and cross-browser compatibility.",
                "Familiarity with end-to-end testing tools (Playwright, Cypress).",
            ]
        elif any(w in title_lower for w in ["full stack", "fullstack", "full-stack"]):
            domain = "Full Stack Engineering"
            primary_tech = "Python/Node.js, React, TypeScript, and cloud-native databases"
            resp = [
                "Own end-to-end feature delivery across frontend interfaces and backend API services.",
                "Architect resilient database schemas and high-throughput data processing workflows.",
                "Collaborate cross-functionally with product managers, designers, and fellow engineers.",
                "Continuously improve development velocity, monitoring, and automated test coverage.",
                "Mentor team members and drive best engineering practices across the entire stack.",
            ]
            must_haves = [
                f"{'5+' if level == 'Senior' else '3+'} years of full-stack web development experience.",
                "Proficiency in frontend technologies (React, TypeScript) and modern backend frameworks.",
                "Solid understanding of relational databases (PostgreSQL/MySQL) and API design principles.",
                "Hands-on experience with Docker, Git, and automated deployment pipelines.",
            ]
            nice_haves = [
                "Experience deploying services to cloud infrastructure (AWS or Google Cloud).",
                "Knowledge of caching layers (Redis) and event-driven architecture.",
                "Familiarity with AI integration or LLM APIs.",
            ]
        elif any(w in title_lower for w in ["devops", "cloud", "sre", "infrastructure", "kubernetes"]):
            domain = "Cloud & DevOps Infrastructure"
            primary_tech = "Kubernetes, Docker, Terraform, CI/CD, and Cloud Platforms (AWS/GCP)"
            resp = [
                "Design, deploy, and operate scalable, multi-region cloud infrastructure.",
                "Build automated CI/CD pipelines ensuring safe, zero-downtime application deployments.",
                "Implement robust observability, monitoring, alerting, and incident response playbooks.",
                "Enforce security best practices, access controls, and infrastructure as code (IaC).",
            ]
            must_haves = [
                f"{'5+' if level == 'Senior' else '3+'} years managing cloud environments (AWS, GCP, or Azure).",
                "Expertise with Kubernetes, Docker containerization, and Terraform / IaC.",
                "Strong scripting skills in Bash or Python for systems automation.",
            ]
            nice_haves = [
                "Experience with Prometheus, Grafana, and distributed tracing.",
                "Security compliance certifications (SOC2, ISO 27001).",
            ]
        else:
            domain = "Software Engineering"
            primary_tech = key_skills or "modern programming languages, web technologies, and database systems"
            resp = [
                "Design and develop robust, scalable software components aligned with product goals.",
                "Collaborate with cross-functional teams to translate user requirements into technical designs.",
                "Write clean, maintainable, and well-tested code following industry best practices.",
                "Participate in code reviews, sprint ceremonies, and continuous architecture refinement.",
            ]
            must_haves = [
                f"{'5+' if level == 'Senior' else '3+'} years of professional experience in software engineering.",
                "Strong problem-solving abilities, algorithmic fundamentals, and object-oriented design.",
                "Proven ability to collaborate effectively in an agile, fast-paced team environment.",
            ]
            nice_haves = [
                "Bachelor's or Master's degree in Computer Science, or equivalent practical experience.",
                "Experience mentoring junior engineers or leading technical initiatives.",
            ]

        if key_skills and key_skills.strip():
            must_haves.append(f"Demonstrated hands-on experience with {key_skills.strip()}.")

        resp_str = "\n".join(f"- {r}" for r in resp)
        must_str = "\n".join(f"- {m}" for m in must_haves)
        nice_str = "\n".join(f"- {n}" for n in nice_haves)

        return f"""# {job_title}

### Role Overview
We are looking for an exceptional **{job_title}** ({level}) to join our team. In this role, you will play a central part in building reliable, high-impact products using {primary_tech}. You will work with a passionate team dedicated to solving challenging problems and delivering best-in-class user experiences.

### Key Responsibilities
{resp_str}

### Must-Have Requirements
{must_str}

### Nice-to-Have Qualifications
{nice_str}

### Benefits & Work Environment
- Competitive salary and comprehensive health coverage
- Flexible remote/hybrid working options
- Continuous learning stipend and professional growth support
- Collaborative, inclusive engineering culture with modern tooling
"""
