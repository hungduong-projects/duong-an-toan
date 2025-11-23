import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navigation from '../components/Navigation';

const DonatePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const [modalImage, setModalImage] = React.useState<string | null>(null);

  // VND Section Component
  const VNDSection = (
    <section className={isEnglish ? "border-t border-slate-200 pt-12" : "mb-12"} key="vnd">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              {t('page.donate.vndSection.heading')}
            </h2>
            <div className="flex flex-col items-center">
              <button
                onClick={() => setModalImage('/images/donation-accounts-1.jpg')}
                className="block w-full max-w-2xl rounded-lg overflow-hidden border-2 border-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
              >
                <img
                  src="/images/donation-accounts-1.jpg"
                  alt={t('page.donate.imageAlt1')}
                  className="w-full h-auto"
                />
              </button>
              <p className="mt-2 text-sm text-slate-600">
                {t('page.donate.clickToEnlarge')}
              </p>
            </div>
          </section>
  );

  // USD Section Component
  const USDSection = (
    <section className={isEnglish ? "mb-12" : "border-t border-slate-200 pt-12"} key="usd">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              {t('page.donate.usdSection.heading')}
            </h2>
            <p className="text-slate-700 mb-6 text-justify">
              {t('page.donate.usdSection.intro')}
            </p>

            {/* USD Account Images */}
            <div className="flex flex-col items-center mb-8">
              <button
                onClick={() => setModalImage('/images/donation-accounts-2.jpg')}
                className="block w-full max-w-2xl rounded-lg overflow-hidden border-2 border-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
              >
                <img
                  src="/images/donation-accounts-2.jpg"
                  alt={t('page.donate.imageAlt2')}
                  className="w-full h-auto"
                />
              </button>
              <p className="mt-2 text-sm text-slate-600">
                {t('page.donate.clickToEnlarge')}
              </p>
            </div>

            {/* USD Account Details - Text Format for Easy Copying */}
            <div className="space-y-6">
              {/* VietinBank USD Account */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-300">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  1. {t('page.donate.usdSection.account1.bank')}
                </h3>
                <div className="space-y-2 text-slate-700 text-justify">
                  <p>{t('page.donate.usdSection.account1.accountName')}</p>
                  <p className="font-semibold">{t('page.donate.usdSection.account1.accountNumber')}</p>
                  <p>{t('page.donate.usdSection.account1.branch')}</p>
                  <p className="font-semibold">{t('page.donate.usdSection.account1.swift')}</p>
                </div>
              </div>

              {/* Vietcombank USD Account */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-300">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  2. {t('page.donate.usdSection.account2.bank')}
                </h3>
                <div className="space-y-2 text-slate-700 text-justify">
                  <p>{t('page.donate.usdSection.account2.accountName')}</p>
                  <p className="font-semibold">{t('page.donate.usdSection.account2.accountNumber')}</p>
                  <p>{t('page.donate.usdSection.account2.branch')}</p>
                  <p className="font-semibold">{t('page.donate.usdSection.account2.swift')}</p>
                </div>
              </div>
            </div>

            {/* Thank You Message */}
            <div className="mt-8 text-center">
              <p className="text-lg font-semibold text-slate-900">
                {t('page.donate.usdSection.thankYou')}
              </p>
            </div>
          </section>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <h1 className="font-bold text-lg text-slate-900">
              {t('nav.brand')}
            </h1>
          </Link>
          <Navigation />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12 border border-slate-200">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            {t('page.donate.heading')}
          </h1>

          {/* Introduction */}
          <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-200">
            <div className="space-y-3 text-slate-700 text-justify">
              <p className="font-semibold">{t('page.donate.intro.paragraph1')}</p>
              <p>{t('page.donate.intro.paragraph2')}</p>
              <p>{t('page.donate.intro.paragraph3')}</p>
            </div>
          </div>

          {/* Conditionally render sections based on language */}
          {isEnglish ? (
            <>
              {USDSection}
              {VNDSection}
            </>
          ) : (
            <>
              {VNDSection}
              {USDSection}
            </>
          )}
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

export default DonatePage;
