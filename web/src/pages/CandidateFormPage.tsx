import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { CandidateForm, type CandidateStudiesState } from '../candidates/CandidateForm';
import { studiesApi } from '../studies/studiesApi';

export function CandidateFormPage() {
  const navigate = useNavigate();
  const { request } = useAuth();
  const [studies, setStudies] = useState<CandidateStudiesState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setStudies({ status: 'loading' });
    void studiesApi.listAvailableForRecruitment(request, controller.signal)
      .then((options) => { if (!controller.signal.aborted) setStudies({ status: 'ready', options }); })
      .catch(() => { if (!controller.signal.aborted) setStudies({ status: 'error' }); });
    return () => controller.abort();
  }, [request]);

  return <div className="coord-page candidate-form-page">
    <header className="coord-page-heading">
      <h1><Link to="/coordenador/candidatos">Candidatos e participantes</Link> <span aria-hidden="true">&gt;</span> Cadastrar candidato</h1>
    </header>
    <section className="study-form-panel candidate-form-panel" aria-labelledby="candidate-form-title">
      <div className="study-form-heading"><h2 id="candidate-form-title">Informações do candidato</h2></div>
      {/* O envio continua indisponível até a integração com a API de candidatos (S2-W2-06). */}
      <CandidateForm studies={studies} onCancel={() => navigate('/coordenador/candidatos')} />
    </section>
  </div>;
}
