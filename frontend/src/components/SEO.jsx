import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({
  title = "atsn ai | Autonomous AI Agents, Custom AI Agents and Chatbots",
  description = "atsn ai creates autonomous AI agents, chatbots, and consultancy solutions. Meet Emily, your AI marketing teammate for smarter business automation.",
  keywords = "AI agents, autonomous AI, digital marketing AI, Emily AI agent, AI content creation, social media automation, AI marketing, business automation",
  image = "https://atsnai.com/emily_icon.png",
  url = "https://atsnai.com",
  type = "website",
  structuredData = null
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags */}


      
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="atsn ai" />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="atsn ai" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Additional SEO Tags */}
      <meta name="theme-color" content="#9E005C" />
      <meta name="msapplication-TileColor" content="#9E005C" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="atsn ai" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Structured Data for SEO */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
