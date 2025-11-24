import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navigation from '../components/Navigation';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const [modalImage, setModalImage] = React.useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <img
              src="/favicon.svg"
              alt={t('nav.brand')}
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
          </Link>
          <Navigation />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12 border border-slate-200">
          {/* Project Introduction */}
          <section className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              {t('page.about.intro.heading')}
            </h1>
            <div className="space-y-4 text-slate-700 text-base md:text-lg leading-relaxed text-justify">
              <p>{t('page.about.intro.paragraph1')}</p>
              <p>{t('page.about.intro.paragraph2')}</p>
              <p>{t('page.about.intro.paragraph3')}</p>
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {t('page.about.features.heading')}
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Flood Risk Feature */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-xl font-bold text-blue-900 mb-4">
                  {t('page.about.features.floodRisk.title')}
                </h3>
                <ul className="space-y-3 text-slate-700 text-justify">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>{t('page.about.features.floodRisk.point1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>{t('page.about.features.floodRisk.point2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>{t('page.about.features.floodRisk.point3')}</span>
                  </li>
                </ul>
              </div>

              {/* Safe Route Feature */}
              <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                <h3 className="text-xl font-bold text-green-900 mb-4">
                  {t('page.about.features.safeRoute.title')}
                </h3>
                <ul className="space-y-3 text-slate-700 text-justify">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>{t('page.about.features.safeRoute.point1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>{t('page.about.features.safeRoute.point2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>{t('page.about.features.safeRoute.point3')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Disclaimer Section */}
          <section className="mb-12 p-6 bg-amber-50 rounded-xl border border-amber-200">
            <div className="space-y-4 text-slate-700 leading-relaxed text-justify">
              <p>{t('page.about.disclaimer.paragraph1')}</p>
              <p>
                {t('page.about.disclaimer.paragraph2')}
                <a
                  href={t('page.about.disclaimer.githubLink')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  {t('page.about.disclaimer.githubLink')}
                </a>
              </p>
            </div>
          </section>

          {/* Donation Section */}
          <section className="border-t border-slate-200 pt-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              {t('page.about.donation.heading')}
            </h2>
            <div className="space-y-4 text-slate-700 mb-6 text-justify">
              <p>{t('page.about.donation.paragraph1')}</p>
              <p>{t('page.about.donation.paragraph2')}</p>
            </div>

            {/* Donation Images - Side by Side */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setModalImage('/images/donation-accounts-1.jpg')}
                className="block rounded-lg overflow-hidden border border-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
              >
                <img
                  src="/images/donation-accounts-1.jpg"
                  alt={t('page.about.donation.imageAlt1')}
                  className="w-full h-auto"
                />
              </button>
              <button
                onClick={() => setModalImage('/images/donation-accounts-2.jpg')}
                className="block rounded-lg overflow-hidden border border-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
              >
                <img
                  src="/images/donation-accounts-2.jpg"
                  alt={t('page.about.donation.imageAlt2')}
                  className="w-full h-auto"
                />
              </button>
            </div>

            {/* Link to Full Donate Page */}
            <div className="text-center">
              <Link
                to="/donate"
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {t('page.about.donation.viewFullDetails')} →
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Image Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <button
            onClick={() => setModalImage(null)}
            className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            ×
          </button>
          <img
            src={modalImage}
            alt="Donation account details"
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default AboutPage;
