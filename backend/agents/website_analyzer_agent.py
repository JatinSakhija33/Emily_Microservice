"""
Website Analyzer Agent
Comprehensive website analysis for SEO, performance, and optimization
"""

import os
import json
import asyncio
import aiohttp
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import logging
from urllib.parse import urljoin, urlparse
import re
from textstat import flesch_reading_ease, flesch_kincaid_grade
import hashlib
from services.token_usage_service import TokenUsageService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class WebsiteAnalysisResult:
    """Data structure for website analysis results"""
    url: str
    analysis_date: datetime
    seo_score: int
    performance_score: int
    accessibility_score: int
    best_practices_score: int
    seo_analysis: Dict[str, Any]
    performance_analysis: Dict[str, Any]
    content_analysis: Dict[str, Any]
    technical_analysis: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    raw_data: Dict[str, Any]

class WebsiteAnalyzerAgent:
    """Agent for comprehensive website analysis"""
    
    def __init__(self):
        self.pagespeed_api_key = os.getenv("GOOGLE_PAGESPEED_API_KEY")
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        
        # Initialize token tracker for usage tracking
        if self.supabase_url and self.supabase_service_key:
            self.token_tracker = TokenUsageService(self.supabase_url, self.supabase_service_key)
        else:
            self.token_tracker = None
        
        if not self.pagespeed_api_key:
            logger.warning("GOOGLE_PAGESPEED_API_KEY not found. PageSpeed analysis will be limited.")
    
    async def analyze_website(self, url: str, user_id: str) -> WebsiteAnalysisResult:
        """Perform comprehensive website analysis"""
        try:
            logger.info(f"Starting website analysis for: {url}")
            
            # Validate URL
            if not self._is_valid_url(url):
                raise ValueError("Invalid URL format")
            
            # Check cache first
            cached_result = await self._get_cached_analysis(url)
            if cached_result and self._is_cache_valid(cached_result):
                logger.info("Returning cached analysis result")
                return cached_result
            
            # Perform analysis tasks in parallel
            tasks = [
                self._analyze_seo(url),
                self._analyze_performance(url),
                self._analyze_content(url),
                self._analyze_technical(url)
            ]
            
            seo_analysis, performance_analysis, content_analysis, technical_analysis = await asyncio.gather(*tasks)
            
            # Generate AI-powered recommendations
            recommendations = await self._generate_recommendations(
                seo_analysis, performance_analysis, content_analysis, technical_analysis, user_id, url
            )
            
            # Calculate overall scores
            seo_score = self._calculate_seo_score(seo_analysis)
            performance_score = self._calculate_performance_score(performance_analysis)
            accessibility_score = self._calculate_accessibility_score(technical_analysis)
            best_practices_score = self._calculate_best_practices_score(technical_analysis)
            
            # Create result object
            result = WebsiteAnalysisResult(
                url=url,
                analysis_date=datetime.now(),
                seo_score=seo_score,
                performance_score=performance_score,
                accessibility_score=accessibility_score,
                best_practices_score=best_practices_score,
                seo_analysis=seo_analysis,
                performance_analysis=performance_analysis,
                content_analysis=content_analysis,
                technical_analysis=technical_analysis,
                recommendations=recommendations,
                raw_data={
                    "seo": seo_analysis,
                    "performance": performance_analysis,
                    "content": content_analysis,
                    "technical": technical_analysis
                }
            )
            
            # Cache the result
            await self._cache_analysis_result(result, user_id)
            
            logger.info(f"Website analysis completed for: {url}")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing website {url}: {str(e)}")
            raise
    
    async def _analyze_seo(self, url: str) -> Dict[str, Any]:
        """Analyze SEO aspects of the website"""
        try:
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)'
            })
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract meta information
            title = soup.find('title')
            title_text = title.get_text().strip() if title else ""
            
            meta_description = soup.find('meta', attrs={'name': 'description'})
            meta_description_text = meta_description.get('content', '') if meta_description else ""
            
            # Analyze headings structure
            headings = {
                'h1': [h.get_text().strip() for h in soup.find_all('h1')],
                'h2': [h.get_text().strip() for h in soup.find_all('h2')],
                'h3': [h.get_text().strip() for h in soup.find_all('h3')],
                'h4': [h.get_text().strip() for h in soup.find_all('h4')],
                'h5': [h.get_text().strip() for h in soup.find_all('h5')],
                'h6': [h.get_text().strip() for h in soup.find_all('h6')]
            }
            
            # Analyze images
            images = soup.find_all('img')
            images_with_alt = [img for img in images if img.get('alt')]
            images_without_alt = [img for img in images if not img.get('alt')]
            
            # Analyze links
            internal_links = []
            external_links = []
            broken_links = []
            
            for link in soup.find_all('a', href=True):
                href = link['href']
                if href.startswith('http'):
                    if urlparse(href).netloc == urlparse(url).netloc:
                        internal_links.append(href)
                    else:
                        external_links.append(href)
                elif href.startswith('/'):
                    internal_links.append(urljoin(url, href))
            
            # Check for schema markup
            schema_scripts = soup.find_all('script', type='application/ld+json')
            schema_markup = len(schema_scripts) > 0
            
            # Analyze meta tags
            meta_tags = {
                'viewport': soup.find('meta', attrs={'name': 'viewport'}) is not None,
                'robots': soup.find('meta', attrs={'name': 'robots'}) is not None,
                'canonical': soup.find('link', attrs={'rel': 'canonical'}) is not None,
                'og_title': soup.find('meta', attrs={'property': 'og:title'}) is not None,
                'og_description': soup.find('meta', attrs={'property': 'og:description'}) is not None,
                'twitter_card': soup.find('meta', attrs={'name': 'twitter:card'}) is not None
            }
            
            return {
                'title': {
                    'text': title_text,
                    'length': len(title_text),
                    'optimal': 50 <= len(title_text) <= 60
                },
                'meta_description': {
                    'text': meta_description_text,
                    'length': len(meta_description_text),
                    'optimal': 150 <= len(meta_description_text) <= 160
                },
                'headings': headings,
                'images': {
                    'total': len(images),
                    'with_alt': len(images_with_alt),
                    'without_alt': len(images_without_alt),
                    'alt_coverage': len(images_with_alt) / len(images) if images else 0
                },
                'links': {
                    'internal': len(internal_links),
                    'external': len(external_links),
                    'broken': len(broken_links)
                },
                'schema_markup': schema_markup,
                'meta_tags': meta_tags,
                'url_structure': {
                    'has_https': url.startswith('https://'),
                    'www_usage': 'www.' in url,
                    'url_length': len(url)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in SEO analysis: {str(e)}")
            return {}
    
    async def _analyze_performance(self, url: str) -> Dict[str, Any]:
        """Analyze website performance using PageSpeed Insights API"""
        try:
            if not self.pagespeed_api_key:
                logger.warning("PageSpeed API key not configured")
                return {'error': 'PageSpeed API key not configured'}
            
            logger.info(f"Calling PageSpeed API for: {url}")
            # PageSpeed Insights API call
            pagespeed_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
            params = {
                'url': url,
                'key': self.pagespeed_api_key,
                'strategy': 'mobile',  # Also analyze mobile performance
                'category': ['performance', 'accessibility', 'best-practices', 'seo']
            }
            
            logger.info(f"PageSpeed API URL: {pagespeed_url}")
            logger.info(f"PageSpeed API params: {params}")
            
            connector = aiohttp.TCPConnector(ssl=False)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(pagespeed_url, params=params) as response:
                    logger.info(f"PageSpeed API response status: {response.status}")
                    if response.status == 200:
                        data = await response.json()
                        logger.info("PageSpeed API call successful, parsing data...")
                        result = self._parse_pagespeed_data(data)
                        logger.info(f"Parsed PageSpeed data: {result}")
                        return result
                    else:
                        error_text = await response.text()
                        logger.error(f"PageSpeed API error: {response.status} - {error_text}")
                        return {'error': f'PageSpeed API returned status {response.status}: {error_text}'}
                        
        except Exception as e:
            logger.error(f"Error in performance analysis: {str(e)}")
            return {'error': str(e)}
    
    def _parse_pagespeed_data(self, data: Dict) -> Dict[str, Any]:
        """Parse PageSpeed Insights API response"""
        try:
            lighthouse_result = data.get('lighthouseResult', {})
            categories = lighthouse_result.get('categories', {})
            audits = lighthouse_result.get('audits', {})
            
            # Extract scores
            scores = {}
            for category, details in categories.items():
                scores[category] = {
                    'score': details.get('score', 0),
                    'title': details.get('title', ''),
                    'description': details.get('description', '')
                }
            
            # Extract Core Web Vitals
            core_web_vitals = {}
            if 'first-contentful-paint' in audits:
                fcp = audits['first-contentful-paint']
                core_web_vitals['fcp'] = {
                    'value': fcp.get('numericValue', 0),
                    'score': fcp.get('score', 0),
                    'displayValue': fcp.get('displayValue', '')
                }
            
            if 'largest-contentful-paint' in audits:
                lcp = audits['largest-contentful-paint']
                core_web_vitals['lcp'] = {
                    'value': lcp.get('numericValue', 0),
                    'score': lcp.get('score', 0),
                    'displayValue': lcp.get('displayValue', '')
                }
            
            if 'cumulative-layout-shift' in audits:
                cls = audits['cumulative-layout-shift']
                core_web_vitals['cls'] = {
                    'value': cls.get('numericValue', 0),
                    'score': cls.get('score', 0),
                    'displayValue': cls.get('displayValue', '')
                }
            
            # Extract opportunities and diagnostics
            opportunities = []
            diagnostics = []
            
            for audit_id, audit in audits.items():
                if audit.get('score') is not None and audit.get('score') < 0.9:
                    if audit.get('details', {}).get('type') == 'opportunity':
                        opportunities.append({
                            'id': audit_id,
                            'title': audit.get('title', ''),
                            'description': audit.get('description', ''),
                            'score': audit.get('score', 0),
                            'savings': audit.get('details', {}).get('overallSavingsMs', 0)
                        })
                    else:
                        diagnostics.append({
                            'id': audit_id,
                            'title': audit.get('title', ''),
                            'description': audit.get('description', ''),
                            'score': audit.get('score', 0)
                        })
            
            return {
                'scores': scores,
                'core_web_vitals': core_web_vitals,
                'opportunities': opportunities[:10],  # Top 10 opportunities
                'diagnostics': diagnostics[:10],  # Top 10 diagnostics
                'raw_data': data
            }
            
        except Exception as e:
            logger.error(f"Error parsing PageSpeed data: {str(e)}")
            return {'error': str(e)}
    
    async def _analyze_content(self, url: str) -> Dict[str, Any]:
        """Analyze content quality and structure"""
        try:
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)'
            })
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract text content
            for script in soup(["script", "style"]):
                script.decompose()
            
            text = soup.get_text()
            words = text.split()
            word_count = len(words)
            
            # Calculate readability scores
            readability_score = flesch_reading_ease(text)
            grade_level = flesch_kincaid_grade(text)
            
            # Analyze content structure
            paragraphs = soup.find_all('p')
            paragraph_count = len(paragraphs)
            avg_paragraph_length = sum(len(p.get_text().split()) for p in paragraphs) / paragraph_count if paragraph_count > 0 else 0
            
            # Analyze keyword density (basic)
            text_lower = text.lower()
            common_words = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
            word_freq = {}
            for word in words:
                word_lower = word.lower().strip('.,!?;:"')
                if word_lower and word_lower not in common_words and len(word_lower) > 3:
                    word_freq[word_lower] = word_freq.get(word_lower, 0) + 1
            
            # Get top keywords
            top_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]
            
            return {
                'word_count': word_count,
                'paragraph_count': paragraph_count,
                'avg_paragraph_length': round(avg_paragraph_length, 2),
                'readability': {
                    'flesch_score': round(readability_score, 2),
                    'grade_level': round(grade_level, 2),
                    'readability_level': self._get_readability_level(readability_score)
                },
                'keywords': {
                    'top_keywords': top_keywords,
                    'keyword_density': len(word_freq)
                },
                'content_structure': {
                    'has_intro': any('introduction' in p.get_text().lower() for p in paragraphs[:3]),
                    'has_conclusion': any('conclusion' in p.get_text().lower() for p in paragraphs[-3:]),
                    'has_subheadings': len(soup.find_all(['h2', 'h3', 'h4'])) > 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error in content analysis: {str(e)}")
            return {}
    
    async def _analyze_technical(self, url: str) -> Dict[str, Any]:
        """Analyze technical aspects of the website"""
        try:
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)'
            })
            
            # Check SSL certificate
            ssl_info = {
                'has_ssl': url.startswith('https://'),
                'certificate_valid': True  # Simplified check
            }
            
            # Check response headers
            headers = response.headers
            security_headers = {
                'content_security_policy': 'content-security-policy' in headers,
                'x_frame_options': 'x-frame-options' in headers,
                'x_content_type_options': 'x-content-type-options' in headers,
                'strict_transport_security': 'strict-transport-security' in headers
            }
            
            # Check robots.txt
            robots_url = urljoin(url, '/robots.txt')
            try:
                robots_response = requests.get(robots_url, timeout=10)
                robots_txt = robots_response.text if robots_response.status_code == 200 else ""
            except:
                robots_txt = ""
            
            # Check sitemap
            sitemap_url = urljoin(url, '/sitemap.xml')
            sitemap_info = {
                'exists': False,
                'url': sitemap_url,
                'url_count': 0,
                'last_modified': None,
                'has_robots_reference': False
            }
            
            try:
                sitemap_response = requests.get(sitemap_url, timeout=10)
                if sitemap_response.status_code == 200:
                    sitemap_info['exists'] = True
                    # Parse sitemap XML
                    try:
                        soup = BeautifulSoup(sitemap_response.content, 'xml')
                        urls = soup.find_all('url')
                        sitemap_info['url_count'] = len(urls)
                        
                        # Get last modified dates
                        lastmods = [url.find('lastmod') for url in urls if url.find('lastmod')]
                        if lastmods:
                            # Get the most recent lastmod
                            dates = [lastmod.text for lastmod in lastmods if lastmod.text]
                            if dates:
                                sitemap_info['last_modified'] = max(dates)
                        
                        # Check if robots.txt references sitemap
                        if 'sitemap' in robots_txt.lower():
                            sitemap_info['has_robots_reference'] = True
                    except Exception as e:
                        logger.warning(f"Error parsing sitemap XML: {e}")
            except Exception as e:
                logger.debug(f"Sitemap not found: {e}")
            
            return {
                'ssl': ssl_info,
                'security_headers': security_headers,
                'response_time': response.elapsed.total_seconds(),
                'status_code': response.status_code,
                'content_type': headers.get('content-type', ''),
                'content_length': len(response.content),
                'robots_txt': {
                    'exists': bool(robots_txt),
                    'content': robots_txt[:500] if robots_txt else "",
                    'references_sitemap': 'sitemap' in robots_txt.lower() if robots_txt else False
                },
                'sitemap': sitemap_info,
                'server_info': {
                    'server': headers.get('server', ''),
                    'powered_by': headers.get('x-powered-by', '')
                }
            }
            
        except Exception as e:
            logger.error(f"Error in technical analysis: {str(e)}")
            return {}
    
    async def _generate_recommendations(self, seo_analysis: Dict, performance_analysis: Dict, 
                                      content_analysis: Dict, technical_analysis: Dict, 
                                      user_id: Optional[str] = None, url: Optional[str] = None) -> List[Dict[str, Any]]:
        """Generate AI-powered recommendations based on analysis"""
        try:
            if not self.openai_api_key:
                return self._generate_basic_recommendations(seo_analysis, performance_analysis, content_analysis, technical_analysis)
            
            # Prepare analysis summary for AI
            analysis_summary = {
                'seo': seo_analysis,
                'performance': performance_analysis,
                'content': content_analysis,
                'technical': technical_analysis
            }
            
            # Call OpenAI API for recommendations
            import openai
            openai.api_key = self.openai_api_key
            
            prompt = f"""
            Analyze this website data and provide 10 actionable recommendations for improvement.
            Focus on SEO, performance, content quality, and technical aspects.
            Return as JSON array with format: [{{"category": "SEO", "priority": "High", "title": "Fix missing meta description", "description": "Add a compelling meta description between 150-160 characters", "impact": "High"}}]
            
            Analysis data: {json.dumps(analysis_summary, indent=2)}
            """
            
            client = openai.AsyncOpenAI(api_key=self.openai_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.7
            )
            
            # Track token usage (non-blocking)
            if self.token_tracker and user_id:
                try:
                    await self.token_tracker.track_chat_completion_usage(
                        user_id=user_id,
                        feature_type="website_analysis",
                        model_name="gpt-4o-mini",
                        response=response,
                        request_metadata={
                            "website_url": url,
                            "analysis_type": "recommendations"
                        }
                    )
                except Exception as e:
                    logger.error(f"Error tracking website analyzer token usage: {str(e)}")
            
            recommendations_text = response.choices[0].message.content
            recommendations = json.loads(recommendations_text)
            
            return recommendations[:10]  # Limit to 10 recommendations
            
        except Exception as e:
            logger.error(f"Error generating AI recommendations: {str(e)}")
            return self._generate_basic_recommendations(seo_analysis, performance_analysis, content_analysis, technical_analysis)
    
    def _generate_basic_recommendations(self, seo_analysis: Dict, performance_analysis: Dict, 
                                      content_analysis: Dict, technical_analysis: Dict) -> List[Dict[str, Any]]:
        """Generate basic recommendations without AI"""
        recommendations = []
        
        # SEO recommendations
        if seo_analysis.get('title', {}).get('length', 0) < 30:
            recommendations.append({
                'category': 'SEO',
                'priority': 'High',
                'title': 'Optimize page title',
                'description': 'Page title is too short. Aim for 50-60 characters.',
                'impact': 'High'
            })
        
        if not seo_analysis.get('meta_description', {}).get('text'):
            recommendations.append({
                'category': 'SEO',
                'priority': 'High',
                'title': 'Add meta description',
                'description': 'Add a compelling meta description between 150-160 characters.',
                'impact': 'High'
            })
        
        # Performance recommendations
        if performance_analysis.get('scores', {}).get('performance', {}).get('score', 0) < 0.9:
            recommendations.append({
                'category': 'Performance',
                'priority': 'High',
                'title': 'Improve page speed',
                'description': 'Page load speed is below optimal. Consider optimizing images and scripts.',
                'impact': 'High'
            })
        
        # Content recommendations
        if content_analysis.get('readability', {}).get('flesch_score', 0) < 30:
            recommendations.append({
                'category': 'Content',
                'priority': 'Medium',
                'title': 'Improve content readability',
                'description': 'Content is difficult to read. Simplify language and sentence structure.',
                'impact': 'Medium'
            })
        
        return recommendations[:10]
    
    def _calculate_seo_score(self, seo_analysis: Dict) -> int:
        """Calculate SEO score (0-100)"""
        score = 0
        
        # Title optimization (20 points)
        if seo_analysis.get('title', {}).get('optimal', False):
            score += 20
        elif seo_analysis.get('title', {}).get('length', 0) > 0:
            score += 10
        
        # Meta description (20 points)
        if seo_analysis.get('meta_description', {}).get('optimal', False):
            score += 20
        elif seo_analysis.get('meta_description', {}).get('length', 0) > 0:
            score += 10
        
        # Image alt texts (20 points)
        alt_coverage = seo_analysis.get('images', {}).get('alt_coverage', 0)
        score += int(alt_coverage * 20)
        
        # Schema markup (20 points)
        if seo_analysis.get('schema_markup', False):
            score += 20
        
        # Meta tags (20 points)
        meta_tags = seo_analysis.get('meta_tags', {})
        meta_score = sum(1 for tag in meta_tags.values() if tag)
        score += int((meta_score / len(meta_tags)) * 20) if meta_tags else 0
        
        return min(score, 100)
    
    def _calculate_performance_score(self, performance_analysis: Dict) -> int:
        """Calculate performance score (0-100)"""
        if 'error' in performance_analysis:
            return 0
        
        scores = performance_analysis.get('scores', {})
        performance_score = scores.get('performance', {}).get('score', 0)
        return int(performance_score * 100)
    
    def _calculate_accessibility_score(self, technical_analysis: Dict) -> int:
        """Calculate accessibility score (0-100)"""
        # This would be enhanced with actual accessibility testing
        score = 0
        
        # Basic checks
        if technical_analysis.get('ssl', {}).get('has_ssl', False):
            score += 20
        
        security_headers = technical_analysis.get('security_headers', {})
        security_score = sum(1 for header in security_headers.values() if header)
        score += int((security_score / len(security_headers)) * 30) if security_headers else 0
        
        return min(score, 100)
    
    def _calculate_best_practices_score(self, technical_analysis: Dict) -> int:
        """Calculate best practices score (0-100)"""
        score = 0
        
        # SSL (30 points)
        if technical_analysis.get('ssl', {}).get('has_ssl', False):
            score += 30
        
        # Security headers (40 points)
        security_headers = technical_analysis.get('security_headers', {})
        security_score = sum(1 for header in security_headers.values() if header)
        score += int((security_score / len(security_headers)) * 40) if security_headers else 0
        
        # Sitemap (15 points)
        if technical_analysis.get('sitemap', {}).get('exists', False):
            score += 15
        
        # Robots.txt (15 points)
        if technical_analysis.get('robots_txt', {}).get('exists', False):
            score += 15
        
        return min(score, 100)
    
    def _is_valid_url(self, url: str) -> bool:
        """Validate URL format"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def _get_readability_level(self, flesch_score: float) -> str:
        """Convert Flesch score to readability level"""
        if flesch_score >= 90:
            return "Very Easy"
        elif flesch_score >= 80:
            return "Easy"
        elif flesch_score >= 70:
            return "Fairly Easy"
        elif flesch_score >= 60:
            return "Standard"
        elif flesch_score >= 50:
            return "Fairly Difficult"
        elif flesch_score >= 30:
            return "Difficult"
        else:
            return "Very Difficult"
    
    async def _get_cached_analysis(self, url: str) -> Optional[WebsiteAnalysisResult]:
        """Get cached analysis result"""
        # Implementation would check database for recent analysis
        return None
    
    def _is_cache_valid(self, result: WebsiteAnalysisResult) -> bool:
        """Check if cached result is still valid (24 hours)"""
        if not result:
            return False
        
        time_diff = datetime.now() - result.analysis_date
        return time_diff.total_seconds() < 86400  # 24 hours
    
    async def _cache_analysis_result(self, result: WebsiteAnalysisResult, user_id: str):
        """Cache analysis result in database"""
        # Implementation would save to database
        pass
